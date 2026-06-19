const Task = require('../models/Task');
const User = require('../models/User');
const Company = require('../models/Company');
const TaskActivity = require('../models/TaskActivity');
const ApiError = require('../utils/ApiError');

const userIdString = (userField) => {
  const raw = userField?._id || userField;
  return raw ? raw.toString() : null;
};

const collectTeamMates = (members, rootUserId) => {
  const result = new Set();
  const rootMember = members.find((m) => userIdString(m.user) === rootUserId.toString());
  if (!rootMember) return [rootUserId.toString()];

  const rootManagerId = rootMember.reportsTo?._id?.toString() || rootMember.reportsTo?.toString() || null;
  for (const m of members) {
    const managerId = m.reportsTo?._id?.toString() || m.reportsTo?.toString() || null;
    if (managerId === rootManagerId) result.add(userIdString(m.user));
  }

  const queue = [rootUserId.toString()];
  while (queue.length) {
    const current = queue.shift();
    for (const m of members) {
      const uid = userIdString(m.user);
      const managerId = m.reportsTo?._id?.toString() || m.reportsTo?.toString() || null;
      if (managerId === current && !result.has(uid)) {
        result.add(uid);
        queue.push(uid);
      }
    }
  }
  return Array.from(result);
};

const buildDateQuery = (filterDate) => {
  if (!filterDate) return {};
  const startOfDay = new Date(filterDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(filterDate);
  endOfDay.setHours(23, 59, 59, 999);
  return { createdAt: { $gte: startOfDay, $lte: endOfDay } };
};

const fetchTeamMembers = async (userId, companyId, filterProjectId) => {
  if (companyId && companyId !== 'personal') {
    const company = await Company.findById(companyId)
      .populate('members.user', 'name email profile')
      .populate('members.reportsTo', '_id');
    if (!company) throw ApiError.notFound('Company not found');
    const isOwner = company.owner.toString() === userId.toString();
    let teamMemberIds = isOwner
      ? company.members.map((m) => userIdString(m.user))
      : collectTeamMates(company.members, userId);
    if (!isOwner) teamMemberIds.push(userId.toString());
    return User.find({ _id: { $in: Array.from(new Set(teamMemberIds)) } })
      .select('name email role profile createdAt')
      .sort({ name: 1 });
  }

  const query = {};
  if (filterProjectId) query.project = filterProjectId;
  else {
    query.$or = [
      { createdBy: userId },
      { assignees: userId },
      { 'roleAssignments.assignees': userId },
      { 'sequentialAssignees.user': userId }
    ];
  }
  const userTasks = await Task.find(query).select('assignees roleAssignments sequentialAssignees');
  const teamMemberIds = new Set();
  userTasks.forEach((task) => {
    (task.assignees || []).forEach((a) => a && teamMemberIds.add(a.toString()));
    (task.roleAssignments || []).forEach((ra) =>
      (ra.assignees || []).forEach((a) => a && teamMemberIds.add(a.toString()))
    );
    (task.sequentialAssignees || []).forEach((sa) => {
      if (sa.user) teamMemberIds.add(sa.user._id ? sa.user._id.toString() : sa.user.toString());
    });
  });
  if (teamMemberIds.size === 0) return [];
  return User.find({ _id: { $in: Array.from(teamMemberIds) } })
    .select('name email role profile createdAt')
    .sort({ name: 1 });
};

const buildActivityForMember = async (member, filterProjectId, dateQuery) => {
  const memberId = member._id;
  const inProgressQuery = {
    $or: [
      { sequentialAssignees: { $elemMatch: { user: memberId, status: 'in_progress' } } },
      { roleAssignments: { $elemMatch: { assignees: memberId, status: { $in: ['active', 'in_progress'] } } } }
    ]
  };
  if (filterProjectId) inProgressQuery.project = filterProjectId;
  const inProgressTask = await Task.findOne(inProgressQuery)
    .populate('project', 'title')
    .populate('status', 'name color')
    .select('title project status createdAt updatedAt');

  if (inProgressTask) {
    const startActivityQuery = { task: inProgressTask._id, performedBy: memberId, action: 'started' };
    if (dateQuery.createdAt) startActivityQuery.createdAt = dateQuery.createdAt;
    const startActivity = await TaskActivity.findOne(startActivityQuery)
      .sort({ createdAt: -1 })
      .select('createdAt');
    const isToday = dateQuery.createdAt &&
      new Date().toISOString().split('T')[0] === new Date(dateQuery.createdAt.$gte).toISOString().split('T')[0];
    if (!dateQuery.createdAt || (dateQuery.createdAt && (startActivity || isToday))) {
      return buildResponse(member, 'in_progress', {
        currentTask: {
          _id: inProgressTask._id,
          title: inProgressTask.title,
          project: inProgressTask.project,
          status: inProgressTask.status,
          startedAt: startActivity?.createdAt || inProgressTask.updatedAt
        }
      });
    }
  }

  const pausedQuery = { sequentialAssignees: { $elemMatch: { user: memberId, status: 'paused' } } };
  if (filterProjectId) pausedQuery.project = filterProjectId;
  const pausedTask = await Task.findOne(pausedQuery)
    .populate('project', 'title')
    .populate('status', 'name color')
    .select('title project status sequentialAssignees')
    .sort({ updatedAt: -1 });

  if (pausedTask) {
    const userAssignee = pausedTask.sequentialAssignees.find((sa) => sa.user.toString() === memberId.toString());
    const pauseDate = userAssignee?.pausedAt || pausedTask.updatedAt;
    if (!dateQuery.createdAt || (dateQuery.createdAt &&
      new Date(pauseDate) >= dateQuery.createdAt.$gte && new Date(pauseDate) <= dateQuery.createdAt.$lte)) {
      return buildResponse(member, 'paused', {
        lastTask: {
          _id: pausedTask._id,
          title: pausedTask.title,
          project: pausedTask.project,
          status: pausedTask.status,
          pausedAt: pauseDate
        }
      });
    }
  }

  const completedActivityQuery = { performedBy: memberId, action: 'completed' };
  if (dateQuery.createdAt) completedActivityQuery.createdAt = dateQuery.createdAt;
  const completedActivity = await TaskActivity.findOne(completedActivityQuery)
    .sort({ createdAt: -1 })
    .populate('task', 'title project')
    .select('task createdAt');

  if (completedActivity?.task) {
    const completedTaskQuery = { _id: completedActivity.task._id };
    if (filterProjectId) completedTaskQuery.project = filterProjectId;
    const completedTask = await Task.findOne(completedTaskQuery)
      .populate('project', 'title')
      .populate('status', 'name color')
      .select('title project status');
    if (completedTask) {
      return buildResponse(member, 'idle', {
        lastTask: {
          _id: completedTask._id,
          title: completedTask.title,
          project: completedTask.project,
          status: completedTask.status,
          completedAt: completedActivity.createdAt
        }
      });
    }
  }

  return buildResponse(member, 'idle', { lastTask: null });
};

const buildResponse = (member, status, extra) => ({
  user: {
    _id: member._id,
    name: member.name,
    email: member.email,
    role: member.role,
    profile: member.profile
  },
  status,
  ...extra
});

const getTeamActivity = async (userId, { companyId, projectId, date }) => {
  const dateQuery = buildDateQuery(date);
  const teamMembers = await fetchTeamMembers(userId, companyId, projectId);
  const teamActivity = await Promise.all(
    teamMembers.map((member) => buildActivityForMember(member, projectId, dateQuery))
  );
  const priority = { in_progress: 1, paused: 2, idle: 3 };
  return teamActivity.sort((a, b) => priority[a.status] - priority[b.status]);
};

module.exports = { getTeamActivity };
