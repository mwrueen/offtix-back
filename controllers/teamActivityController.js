const Task = require('../models/Task');
const User = require('../models/User');
const Company = require('../models/Company');
const TaskActivity = require('../models/TaskActivity');

/**
 * Recursively collect all descendant user IDs from the reporting tree.
 * members: array of company.members (each has user._id and reportsTo as ObjectId or null)
 * rootUserId: the starting user whose subordinates we want
 */
function collectSubordinates(members, rootUserId) {
  const result = new Set();
  const queue = [rootUserId.toString()];
  while (queue.length) {
    const current = queue.shift();
    for (const m of members) {
      const uid = m.user?._id?.toString() || m.user?.toString();
      const reportsTo = m.reportsTo?._id?.toString() || m.reportsTo?.toString() || null;
      if (reportsTo === current && !result.has(uid)) {
        result.add(uid);
        queue.push(uid);
      }
    }
  }
  return Array.from(result);
}

// Get team members and their current task activity
exports.getTeamActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    const companyIdHeader = req.headers['x-company-id'];
    const companyIdQuery = req.query.companyId;
    const companyId = (companyIdHeader === 'personal' || companyIdQuery === 'personal')
      ? 'personal'
      : (companyIdHeader || companyIdQuery);

    const filterProjectId = req.query.projectId;
    const filterDate = req.query.date;

    console.log(`[TeamActivity] Context: User=${userId}, Role=${userRole}, Company=${companyId}, Project=${filterProjectId}`);

    let dateQuery = {};
    if (filterDate) {
      const startOfDay = new Date(filterDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filterDate);
      endOfDay.setHours(23, 59, 59, 999);
      dateQuery = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    }

    let teamMembers = [];

    if (userRole === 'superadmin') {
      const userQuery = {};
      if (companyId && companyId !== 'personal') {
        userQuery.company = companyId;
      } else if (companyId === 'personal') {
        userQuery.company = null;
      }
      teamMembers = await User.find(userQuery)
        .select('name email role profile createdAt')
        .sort({ name: 1 });

    } else if (userRole === 'admin') {
      let targetCompanyId = (companyId && companyId !== 'personal') ? companyId : (companyId === 'personal' ? null : req.user.company);
      if (targetCompanyId) {
        teamMembers = await User.find({
          company: targetCompanyId,
          role: { $in: ['user', 'admin'] }
        })
          .select('name email role profile createdAt')
          .sort({ name: 1 });
      }

    } else {
      // Regular users — show only their direct reports chain (all descendants)
      if (companyId && companyId !== 'personal') {
        // Load company members with reportsTo populated
        const company = await Company.findById(companyId)
          .populate('members.user', 'name email profile')
          .populate('members.reportsTo', '_id');

        if (company) {
          const subordinateIds = collectSubordinates(company.members, userId);

          if (subordinateIds.length > 0) {
            teamMembers = await User.find({ _id: { $in: subordinateIds } })
              .select('name email role profile createdAt')
              .sort({ name: 1 });
          }
          // If no subordinates, teamMembers stays empty — user has no reports
        }
      } else {
        // Personal mode: discover via tasks
        const query = {};
        if (filterProjectId) {
          query.project = filterProjectId;
        } else {
          query.$or = [
            { createdBy: userId },
            { assignees: userId },
            { 'roleAssignments.assignees': userId },
            { 'sequentialAssignees.user': userId }
          ];
        }

        const userTasks = await Task.find(query).select('assignees roleAssignments sequentialAssignees');
        const teamMemberIds = new Set();
        userTasks.forEach(task => {
          (task.assignees || []).forEach(a => a && teamMemberIds.add(a.toString()));
          (task.roleAssignments || []).forEach(ra =>
            (ra.assignees || []).forEach(a => a && teamMemberIds.add(a.toString()))
          );
          (task.sequentialAssignees || []).forEach(sa => {
            if (sa.user) teamMemberIds.add(sa.user._id ? sa.user._id.toString() : sa.user.toString());
          });
        });

        if (teamMemberIds.size > 0) {
          teamMembers = await User.find({ _id: { $in: Array.from(teamMemberIds) } })
            .select('name email role profile createdAt')
            .sort({ name: 1 });
        }
      }
    }

    console.log(`[TeamActivity] Found ${teamMembers.length} team members`);

    const teamActivity = await Promise.all(
      teamMembers.map(async (member) => {
        const memberId = member._id;

        // In-progress task
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
          const startActivityQuery = {
            task: inProgressTask._id,
            performedBy: memberId,
            action: 'started'
          };
          if (filterDate) startActivityQuery.createdAt = dateQuery.createdAt;

          const startActivity = await TaskActivity.findOne(startActivityQuery)
            .sort({ createdAt: -1 })
            .select('createdAt');

          const isToday = filterDate === new Date().toISOString().split('T')[0];
          if (!filterDate || (filterDate && (startActivity || isToday))) {
            return {
              user: { _id: member._id, name: member.name, email: member.email, role: member.role, profile: member.profile },
              status: 'in_progress',
              currentTask: {
                _id: inProgressTask._id,
                title: inProgressTask.title,
                project: inProgressTask.project,
                status: inProgressTask.status,
                startedAt: startActivity?.createdAt || inProgressTask.updatedAt
              }
            };
          }
        }

        // Paused task
        const pausedQuery = {
          sequentialAssignees: { $elemMatch: { user: memberId, status: 'paused' } }
        };
        if (filterProjectId) pausedQuery.project = filterProjectId;

        const pausedTask = await Task.findOne(pausedQuery)
          .populate('project', 'title')
          .populate('status', 'name color')
          .select('title project status sequentialAssignees')
          .sort({ updatedAt: -1 });

        if (pausedTask) {
          const userAssignee = pausedTask.sequentialAssignees.find(sa => sa.user.toString() === memberId.toString());
          const pauseDate = userAssignee?.pausedAt || pausedTask.updatedAt;
          const isToday = filterDate === new Date().toISOString().split('T')[0];

          if (!filterDate || (filterDate && (isToday || (new Date(pauseDate) >= dateQuery.createdAt?.$gte && new Date(pauseDate) <= dateQuery.createdAt?.$lte)))) {
            return {
              user: { _id: member._id, name: member.name, email: member.email, role: member.role, profile: member.profile },
              status: 'paused',
              lastTask: {
                _id: pausedTask._id,
                title: pausedTask.title,
                project: pausedTask.project,
                status: pausedTask.status,
                pausedAt: pauseDate
              }
            };
          }
        }

        // Last completed task
        const completedActivityQuery = { performedBy: memberId, action: 'completed' };
        if (filterDate) completedActivityQuery.createdAt = dateQuery.createdAt;

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
            return {
              user: { _id: member._id, name: member.name, email: member.email, role: member.role, profile: member.profile },
              status: 'idle',
              lastTask: {
                _id: completedTask._id,
                title: completedTask.title,
                project: completedTask.project,
                status: completedTask.status,
                completedAt: completedActivity.createdAt
              }
            };
          }
        }

        return {
          user: { _id: member._id, name: member.name, email: member.email, role: member.role, profile: member.profile },
          status: 'idle',
          lastTask: null
        };
      })
    );

    const sortedActivity = teamActivity.sort((a, b) => {
      const p = { in_progress: 1, paused: 2, idle: 3 };
      return p[a.status] - p[b.status];
    });

    res.json(sortedActivity);
  } catch (error) {
    console.error('Error fetching team activity:', error);
    res.status(500).json({ error: error.message });
  }
};
