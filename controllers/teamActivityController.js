const Task = require('../models/Task');
const User = require('../models/User');
const TaskActivity = require('../models/TaskActivity');

// Get team members and their current task activity
exports.getTeamActivity = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Find all users under this user (based on role hierarchy)
    let teamMembers = [];

    if (userRole === 'superadmin') {
      // Superadmin can see all users
      teamMembers = await User.find({ _id: { $ne: userId } })
        .select('name email role profile createdAt')
        .sort({ name: 1 });
    } else if (userRole === 'admin') {
      // Admin can see users in their company
      const currentUser = await User.findById(userId).populate('company');
      if (currentUser.company) {
        teamMembers = await User.find({
          company: currentUser.company._id,
          _id: { $ne: userId },
          role: { $in: ['user', 'admin'] }
        })
          .select('name email role profile createdAt')
          .sort({ name: 1 });
      }
    } else {
      // Regular users can see team members in their projects
      const userTasks = await Task.find({
        $or: [
          { createdBy: userId },
          { assignees: userId },
          { 'roleAssignments.assignees': userId },
          { 'sequentialAssignees.user': userId }
        ]
      }).select('assignees roleAssignments sequentialAssignees');

      const teamMemberIds = new Set();
      userTasks.forEach(task => {
        // Add regular assignees
        if (task.assignees) {
          task.assignees.forEach(assignee => {
            if (assignee.toString() !== userId.toString()) {
              teamMemberIds.add(assignee.toString());
            }
          });
        }
        // Add role assignees
        if (task.roleAssignments) {
          task.roleAssignments.forEach(ra => {
            if (ra.assignees) {
              ra.assignees.forEach(assignee => {
                if (assignee.toString() !== userId.toString()) {
                  teamMemberIds.add(assignee.toString());
                }
              });
            }
          });
        }
        // Add sequential assignees
        if (task.sequentialAssignees) {
          task.sequentialAssignees.forEach(sa => {
            const assigneeId = sa.user._id ? sa.user._id.toString() : sa.user.toString();
            if (assigneeId !== userId.toString()) {
              teamMemberIds.add(assigneeId);
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

    // For each team member, find their current task status
    const teamActivity = await Promise.all(
      teamMembers.map(async (member) => {
        const memberId = member._id;

        // Find current in-progress task
        const inProgressTask = await Task.findOne({
          $or: [
            { 'sequentialAssignees.user': memberId, 'sequentialAssignees.status': 'in_progress' },
            { 'roleAssignments.assignees': memberId, 'roleAssignments.status': { $in: ['active', 'in_progress'] } }
          ]
        })
          .populate('project', 'title')
          .populate('status', 'name color')
          .select('title project status createdAt updatedAt');

        if (inProgressTask) {
          // Find when they started this task
          const startActivity = await TaskActivity.findOne({
            task: inProgressTask._id,
            performedBy: memberId,
            action: 'started'
          })
            .sort({ createdAt: -1 })
            .select('createdAt');

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

        // Find last paused task
        const pausedTask = await Task.findOne({
          'sequentialAssignees.user': memberId,
          'sequentialAssignees.status': 'paused'
        })
          .populate('project', 'title')
          .populate('status', 'name color')
          .select('title project status sequentialAssignees')
          .sort({ updatedAt: -1 });

        if (pausedTask) {
          const userAssignee = pausedTask.sequentialAssignees.find(
            sa => sa.user.toString() === memberId.toString()
          );

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
              pausedAt: userAssignee?.pausedAt || pausedTask.updatedAt
            }
          };
        }

        // Find last completed task
        const completedActivity = await TaskActivity.findOne({
          performedBy: memberId,
          action: 'completed'
        })
          .sort({ createdAt: -1 })
          .populate('task', 'title')
          .select('task createdAt');

        if (completedActivity && completedActivity.task) {
          const completedTask = await Task.findById(completedActivity.task._id)
            .populate('project', 'title')
            .populate('status', 'name color')
            .select('title project status');

          return {
            user: {
              _id: member._id,
              name: member.name,
              email: member.email,
              role: member.role,
              profile: member.profile
            },
            status: 'idle',
            lastTask: completedTask ? {
              _id: completedTask._id,
              title: completedTask.title,
              project: completedTask.project,
              status: completedTask.status,
              completedAt: completedActivity.createdAt
            } : null
          };
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
