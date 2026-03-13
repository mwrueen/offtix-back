const Task = require('../models/Task');
const User = require('../models/User');
const TaskActivity = require('../models/TaskActivity');

// Get team members and their current task activity
exports.getTeamActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Resolve companyId for admin/superadmin
    const companyIdHeader = req.headers['x-company-id'];
    const companyIdQuery = req.query.companyId;
    const companyId = (companyIdHeader === 'personal' || companyIdQuery === 'personal') ? 'personal' : (companyIdHeader || companyIdQuery);

    const filterProjectId = req.query.projectId;
    const filterDate = req.query.date; // Expecting YYYY-MM-DD

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
        userQuery.company = null; // Find users with no company if in personal mode
      }
      teamMembers = await User.find(userQuery)
        .select('name email role profile createdAt')
        .sort({ name: 1 });
    } else if (userRole === 'admin') {
      // Use companyId if provided and not 'personal', otherwise use user's company
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
      // Regular users
      if (companyId && companyId !== 'personal') {
        // If viewing a company, show all members of that company
        teamMembers = await User.find({
          company: companyId
        })
          .select('name email role profile createdAt')
          .sort({ name: 1 });
      } else {
        // Personal mode or no company specified: discover from tasks
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
          if (task.assignees) {
            task.assignees.forEach(assignee => {
              if (assignee) teamMemberIds.add(assignee.toString());
            });
          }
          if (task.roleAssignments) {
            task.roleAssignments.forEach(ra => {
              if (ra.assignees) {
                ra.assignees.forEach(assignee => {
                  if (assignee) teamMemberIds.add(assignee.toString());
                });
              }
            });
          }
          if (task.sequentialAssignees) {
            task.sequentialAssignees.forEach(sa => {
              if (sa.user) {
                const id = sa.user._id ? sa.user._id.toString() : sa.user.toString();
                teamMemberIds.add(id);
              }
            });
          }
        });

        if (teamMemberIds.size > 0) {
          teamMembers = await User.find({ _id: { $in: Array.from(teamMemberIds) } })
            .select('name email role profile createdAt')
            .sort({ name: 1 });
        }
      }
    }

    console.log(`[TeamActivity] Found ${teamMembers.length} team members`);

    // For each team member, find their task status based on filters
    const teamActivity = await Promise.all(
      teamMembers.map(async (member) => {
        const memberId = member._id;

        // Find in-progress task with project filter
        const inProgressQuery = {
          $or: [
            { sequentialAssignees: { $elemMatch: { user: memberId, status: 'in_progress' } } },
            { roleAssignments: { $elemMatch: { assignees: memberId, status: { $in: ['active', 'in_progress'] } } } }
          ]
        };

        if (filterProjectId) {
          inProgressQuery.project = filterProjectId;
        }

        const inProgressTask = await Task.findOne(inProgressQuery)
          .populate('project', 'title')
          .populate('status', 'name color')
          .select('title project status createdAt updatedAt');

        if (inProgressTask) {
          // Find when they started this task, potentially within date range
          const startActivityQuery = {
            task: inProgressTask._id,
            performedBy: memberId,
            action: 'started'
          };

          if (filterDate) {
            startActivityQuery.createdAt = dateQuery.createdAt;
          }

          const startActivity = await TaskActivity.findOne(startActivityQuery)
            .sort({ createdAt: -1 })
            .select('createdAt');

          // If filtering by date, we show in-progress tasks if:
          // 1. They started on that date (startActivity exists)
          // 2. The filter is for today (meaning they are currently in-progress)
          const isToday = filterDate === new Date().toISOString().split('T')[0];

          if (!filterDate || (filterDate && (startActivity || isToday))) {
            return {
              user: {
                _id: member._id,
                name: member.name,
                email: member.email,
                role: member.role,
                profile: member.profile
              },
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

        // Find last paused task with project filter
        const pausedQuery = {
          sequentialAssignees: {
            $elemMatch: {
              user: memberId,
              status: 'paused'
            }
          }
        };

        if (filterProjectId) {
          pausedQuery.project = filterProjectId;
        }

        const pausedTask = await Task.findOne(pausedQuery)
          .populate('project', 'title')
          .populate('status', 'name color')
          .select('title project status sequentialAssignees')
          .sort({ updatedAt: -1 });

        if (pausedTask) {
          const userAssignee = pausedTask.sequentialAssignees.find(
            sa => sa.user.toString() === memberId.toString()
          );

          const pauseDate = userAssignee?.pausedAt || pausedTask.updatedAt;
          const isToday = filterDate === new Date().toISOString().split('T')[0];

          if (!filterDate || (filterDate && (isToday || (new Date(pauseDate) >= dateQuery.createdAt.$gte && new Date(pauseDate) <= dateQuery.createdAt.$lte)))) {
            return {
              user: {
                _id: member._id,
                name: member.name,
                email: member.email,
                role: member.role,
                profile: member.profile
              },
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

        // Find last completed task with filters
        const completedActivityQuery = {
          performedBy: memberId,
          action: 'completed'
        };

        if (filterDate) {
          completedActivityQuery.createdAt = dateQuery.createdAt;
        }

        const completedActivity = await TaskActivity.findOne(completedActivityQuery)
          .sort({ createdAt: -1 })
          .populate('task', 'title project')
          .select('task createdAt');

        if (completedActivity && completedActivity.task) {
          // If filtering by project, check if the completed task belongs to that project
          const completedTaskQuery = { _id: completedActivity.task._id };
          if (filterProjectId) {
            completedTaskQuery.project = filterProjectId;
          }

          const completedTask = await Task.findOne(completedTaskQuery)
            .populate('project', 'title')
            .populate('status', 'name color')
            .select('title project status');

          if (completedTask) {
            return {
              user: {
                _id: member._id,
                name: member.name,
                email: member.email,
                role: member.role,
                profile: member.profile
              },
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

        // No task activity found
        return {
          user: {
            _id: member._id,
            name: member.name,
            email: member.email,
            role: member.role,
            profile: member.profile
          },
          status: 'idle',
          lastTask: null
        };
      })
    );

    // Sort by status priority: in_progress > paused > idle
    const sortedActivity = teamActivity.sort((a, b) => {
      const statusPriority = { in_progress: 1, paused: 2, idle: 3 };
      return statusPriority[a.status] - statusPriority[b.status];
    });

    res.json(sortedActivity);
  } catch (error) {
    console.error('Error fetching team activity:', error);
    res.status(500).json({ error: error.message });
  }
};
