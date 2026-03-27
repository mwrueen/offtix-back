const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');
const User = require('../models/User');
const TaskRole = require('../models/TaskRole');
const Notification = require('../models/Notification');
const TaskUserDuration = require('../models/TaskUserDuration');
const { validationResult } = require('express-validator');

exports.getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id);
    const isSuperAdmin = user.role === 'superadmin';

    // Check if user has access to this project
    let hasAccess = false;

    // Superadmin always has access
    if (isSuperAdmin) {
      hasAccess = true;
    }
    // Check if user is the project owner
    else if (project.owner.equals(req.user._id)) {
      hasAccess = true;
    }
    // Check if user is a project member
    else if (project.members.some(member => {
      const memberId = member.user?._id || member.user;
      return memberId && memberId.toString() === req.user._id.toString();
    })) {
      hasAccess = true;
    }
    // Check if project belongs to a company and user is the company owner (not just a member)
    else if (project.company) {
      const Company = require('../models/Company');
      const company = await Company.findById(project.company);
      if (company) {
        // Only company owner has access to all projects, not regular members
        hasAccess = company.owner.toString() === req.user._id.toString();
      }
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to view tasks for this project.'
      });
    }

    const tasks = await Task.find({ project: projectId })
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name profile')
      .populate('status', 'name color')
      .populate('parent', 'title')
      .populate('sprint', 'name sprintNumber')
      .populate('phase', 'name')
      .populate('roleAssignments.role', 'name color icon order')
      .populate('roleAssignments.assignees', 'name email profile')
      .populate('roleAssignments.handoff.handoffBy', 'name email')
      .populate('sequentialAssignees.user', 'name email profile')
      .sort({ order: 1, createdAt: 1 });

    // Aggregate total duration per task from TaskUserDuration
    const taskIds = tasks.map(t => t._id);
    const durationAgg = await TaskUserDuration.aggregate([
      { $match: { task: { $in: taskIds } } },
      { $group: { _id: '$task', totalMinutes: { $sum: '$durationMinutes' } } }
    ]);
    const durationMap = {};
    durationAgg.forEach(d => { durationMap[d._id.toString()] = d.totalMinutes; });

    // Build hierarchical structure
    const taskMap = new Map();
    const rootTasks = [];

    tasks.forEach(task => {
      const obj = task.toObject();
      obj.totalDurationMinutes = durationMap[task._id.toString()] || 0;
      taskMap.set(task._id.toString(), { ...obj, subtasks: [] });
    });

    tasks.forEach(task => {
      if (task.parent) {
        const parentTask = taskMap.get(task.parent._id.toString());
        if (parentTask) {
          parentTask.subtasks.push(taskMap.get(task._id.toString()));
        }
      } else {
        rootTasks.push(taskMap.get(task._id.toString()));
      }
    });

    res.json(rootTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTask = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { projectId } = req.params;

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;

    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString()) ||
      isSuperAdmin || isCompanyCreator;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Sanitize request body - convert empty strings to undefined for optional fields
    const sanitizedBody = { ...req.body };

    // Handle ObjectId fields - convert empty strings to undefined
    ['status', 'sprint', 'phase', 'parent'].forEach(field => {
      if (sanitizedBody[field] === '') {
        sanitizedBody[field] = undefined;
      }
    });

    // Handle priority - convert empty string to undefined
    if (sanitizedBody.priority === '') {
      sanitizedBody.priority = undefined;
    }

    // Handle dates - convert empty strings to undefined
    ['startDate', 'dueDate'].forEach(field => {
      if (sanitizedBody[field] === '') {
        sanitizedBody[field] = undefined;
      }
    });

    // Handle duration - remove if value is empty
    if (sanitizedBody.duration && (!sanitizedBody.duration.value || sanitizedBody.duration.value === '')) {
      sanitizedBody.duration = undefined;
    }

    const task = new Task({
      ...sanitizedBody,
      project: projectId,
      createdBy: req.user._id
    });

    await task.save();
    await task.populate('assignees', 'name email profile');
    await task.populate('createdBy', 'name');
    await task.populate('status', 'name color');
    await task.populate('parent', 'title');
    await task.populate('sprint', 'name sprintNumber');
    await task.populate('phase', 'name');

    res.status(201).json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project access
    const project = await Project.findById(task.project);
    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;

    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString()) ||
      isSuperAdmin || isCompanyCreator;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Sanitize request body - convert empty strings to undefined for optional fields
    const sanitizedBody = { ...req.body };

    // Handle ObjectId fields - convert empty strings to undefined
    ['status', 'sprint', 'phase', 'parent'].forEach(field => {
      if (sanitizedBody[field] === '') {
        sanitizedBody[field] = undefined;
      }
    });

    // Handle priority - convert empty string to undefined
    if (sanitizedBody.priority === '') {
      sanitizedBody.priority = undefined;
    }

    // Handle dates - convert empty strings to undefined
    ['startDate', 'dueDate'].forEach(field => {
      if (sanitizedBody[field] === '') {
        sanitizedBody[field] = undefined;
      }
    });

    // Handle duration - remove if value is empty
    if (sanitizedBody.duration && (!sanitizedBody.duration.value || sanitizedBody.duration.value === '')) {
      sanitizedBody.duration = undefined;
    }

    Object.assign(task, sanitizedBody);
    await task.save();
    await task.populate('assignees', 'name email profile');
    await task.populate('createdBy', 'name');
    await task.populate('status', 'name color');
    await task.populate('parent', 'title');
    await task.populate('sprint', 'name sprintNumber');
    await task.populate('phase', 'name');

    res.json(task);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project access
    const project = await Project.findById(task.project);
    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;

    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString()) ||
      isSuperAdmin || isCompanyCreator;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Task.findByIdAndDelete(req.params.taskId);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.reorderTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskOrders } = req.body; // Array of { taskId, order }

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;

    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString()) ||
      isSuperAdmin || isCompanyCreator;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update task orders in bulk
    const updatePromises = taskOrders.map(({ taskId, order }) =>
      Task.findByIdAndUpdate(taskId, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    // Return updated tasks
    const tasks = await Task.find({ project: projectId })
      .populate('assignees', 'name email profile')
      .populate('createdBy', 'name')
      .populate('status', 'name color')
      .populate('parent', 'title')
      .populate('sprint', 'name sprintNumber')
      .populate('phase', 'name')
      .sort({ order: 1, createdAt: 1 });

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to populate task with all fields including role assignments
const populateTask = async (task) => {
  await task.populate('assignees', 'name email profile');
  await task.populate('createdBy', 'name email');
  await task.populate('status', 'name color');
  await task.populate('parent', 'title');
  await task.populate('sprint', 'name sprintNumber');
  await task.populate('phase', 'name');
  await task.populate('roleAssignments.role', 'name color icon order');
  await task.populate('roleAssignments.assignees', 'name email profile');
  await task.populate('roleAssignments.handoff.handoffBy', 'name email');
  return task;
};

// Helper function to send role notifications
const sendRoleNotification = async (type, userId, task, role, handoffData = null, fromUser = null, io = null) => {
  let companyId = task.company;
  if (!companyId && task.project) {
    try {
      const p = await Project.findById(task.project).select('company').lean();
      companyId = p?.company || null;
    } catch (_) { }
  }
  const title = type === 'task_role_assignment'
    ? `Assigned to role: ${role.name}`
    : type === 'task_role_handoff'
      ? `Role handoff: ${role.name}`
      : `Role completed: ${role.name}`;
  const message = type === 'task_role_assignment'
    ? `You have been assigned to the "${role.name}" role for task "${task.title}"`
    : type === 'task_role_handoff'
      ? `The "${role.name}" role is now ready for you on task "${task.title}"`
      : `Your role "${role.name}" has been completed on task "${task.title}"`;

  const notification = new Notification({
    user: userId,
    company: companyId || undefined,
    type,
    title,
    message,
    relatedId: task._id,
    relatedModel: 'Task',
    metadata: {
      taskId: task._id,
      roleId: role._id,
      roleName: role.name,
      handoffComment: handoffData?.comment,
      handoffFiles: handoffData?.files,
      handoffUrls: handoffData?.urls,
      fromUser: fromUser
    }
  });
  await notification.save();

  // 🔔 Real-time socket event
  if (io) {
    const socketEvent = type === 'task_role_assignment' ? 'task:assigned'
      : type === 'task_role_handoff' ? 'task:role_handoff' : 'task:role_handoff';
    io.to(`user:${userId}`).emit(socketEvent, {
      type,
      title,
      message,
      taskId: task._id,
      companyId: companyId || undefined
    });
  }
};

// Start task workflow - activates first role
exports.startTaskWorkflow = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.useRoleWorkflow || task.roleAssignments.length === 0) {
      return res.status(400).json({ error: 'Task does not have role workflow configured' });
    }

    if (task.currentRoleIndex >= 0) {
      // Workflow already running — just return current state (idempotent)
      await populateTask(task);
      return res.json(task);
    }

    // Activate first role
    task.currentRoleIndex = 0;
    task.roleAssignments[0].status = 'active';
    task.roleAssignments[0].startedAt = new Date();

    await task.save();
    await populateTask(task);

    // Notify assignees of first role
    const io = req.app.get('io');
    const firstRole = task.roleAssignments[0];
    for (const assignee of firstRole.assignees) {
      await sendRoleNotification('task_role_assignment', assignee._id, task, firstRole.role, null, null, io);
    }

    res.json(task);
  } catch (error) {
    console.error('Error starting task workflow:', error);
    res.status(500).json({ error: error.message });
  }
};

// Complete current role and handoff to next
exports.completeRoleAndHandoff = async (req, res) => {
  try {
    const { taskId } = req.params;
    let { comment, files, urls } = req.body;

    // Handle multipart/form-data
    if (req.files && req.files.length > 0) {
      files = req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        size: file.size,
        uploadedAt: new Date()
      }));
    }

    // Parse URLs if it's a string (from FormData)
    if (typeof urls === 'string') {
      try {
        urls = JSON.parse(urls);
      } catch (e) {
        urls = [];
      }
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (task.currentRoleIndex < 0) {
      return res.status(400).json({ error: 'Workflow not started' });
    }

    const currentRole = task.roleAssignments[task.currentRoleIndex];
    if (!currentRole || currentRole.status !== 'active') {
      return res.status(400).json({ error: 'No active role to complete' });
    }

    // Check if user is assigned to current role
    const isAssigned = currentRole.assignees.some(a => a.toString() === req.user._id.toString());
    if (!isAssigned) {
      return res.status(403).json({ error: 'You are not assigned to the current role' });
    }

    // Complete current role with handoff data
    currentRole.status = 'completed';
    currentRole.completedAt = new Date();
    currentRole.handoff = {
      comment: comment || '',
      files: files || [],
      urls: (urls || []).filter(u => u.title && u.url),
      handoffBy: req.user._id,
      handoffAt: new Date()
    };

    // Move to next role if exists
    const nextRoleIndex = task.currentRoleIndex + 1;
    if (nextRoleIndex < task.roleAssignments.length) {
      task.currentRoleIndex = nextRoleIndex;
      task.roleAssignments[nextRoleIndex].status = 'active';
      task.roleAssignments[nextRoleIndex].startedAt = new Date();
    }

    await task.save();
    await populateTask(task);

    // Notify next role assignees
    if (nextRoleIndex < task.roleAssignments.length) {
      const io = req.app.get('io');
      const nextRole = task.roleAssignments[nextRoleIndex];
      for (const assignee of nextRole.assignees) {
        await sendRoleNotification(
          'task_role_handoff',
          assignee._id,
          task,
          nextRole.role,
          currentRole.handoff,
          req.user._id,
          io
        );
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Error completing role handoff:', error);
    res.status(500).json({ error: error.message });
  }
};

// Skip current role and move to next
exports.skipCurrentRole = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project ownership (only owner can skip roles)
    const project = await Project.findById(task.project);
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can skip roles' });
    }

    if (task.currentRoleIndex < 0) {
      return res.status(400).json({ error: 'Workflow not started' });
    }

    const currentRole = task.roleAssignments[task.currentRoleIndex];
    if (!currentRole || currentRole.status !== 'active') {
      return res.status(400).json({ error: 'No active role to skip' });
    }

    // Skip current role
    currentRole.status = 'skipped';
    currentRole.completedAt = new Date();
    currentRole.handoff = {
      comment: reason || 'Role skipped',
      handoffBy: req.user._id,
      handoffAt: new Date()
    };

    // Move to next role
    const nextRoleIndex = task.currentRoleIndex + 1;
    if (nextRoleIndex < task.roleAssignments.length) {
      task.currentRoleIndex = nextRoleIndex;
      task.roleAssignments[nextRoleIndex].status = 'active';
      task.roleAssignments[nextRoleIndex].startedAt = new Date();
    }

    await task.save();
    await populateTask(task);

    // Notify next role assignees
    if (nextRoleIndex < task.roleAssignments.length) {
      const nextRole = task.roleAssignments[nextRoleIndex];
      for (const assignee of nextRole.assignees) {
        await sendRoleNotification('task_role_handoff', assignee._id, task, nextRole.role);
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Error skipping role:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update role assignments for a task
exports.updateRoleAssignments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { roleAssignments, useRoleWorkflow } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project access
    const project = await Project.findById(task.project);
    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Cannot modify role assignments if workflow is in progress
    if (task.currentRoleIndex >= 0 && task.roleAssignments.some(ra => ra.status === 'active')) {
      return res.status(400).json({
        error: 'Cannot modify role assignments while workflow is in progress'
      });
    }

    // Validate role assignments
    if (roleAssignments && roleAssignments.length > 0) {
      for (const assignment of roleAssignments) {
        const role = await TaskRole.findById(assignment.role);
        if (!role || role.project.toString() !== task.project.toString()) {
          return res.status(400).json({ error: 'Invalid role in assignments' });
        }
      }

      // Sort by order and set status to pending
      task.roleAssignments = roleAssignments.map((ra, index) => ({
        role: ra.role,
        order: ra.order || index + 1,
        assignees: ra.assignees || [],
        status: ra.status || 'pending',
        duration: ra.duration
      }));
    } else {
      task.roleAssignments = [];
    }

    task.useRoleWorkflow = useRoleWorkflow !== undefined ? useRoleWorkflow : roleAssignments?.length > 0;
    task.currentRoleIndex = -1;

    await task.save();
    await populateTask(task);

    res.json(task);
  } catch (error) {
    console.error('Error updating role assignments:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single task with full workflow details
exports.getTaskWithWorkflow = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await populateTask(task);

    res.json(task);
  } catch (error) {
    console.error('Error fetching task with workflow:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.bulkScheduleTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { schedules } = req.body; // Array of { taskId, startDate, dueDate }

    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: 'Schedules must be an array' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;

    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString()) ||
      isSuperAdmin || isCompanyCreator;

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Perform bulk update
    const bulkOps = schedules.map(s => {
      if (s.roleId) {
        return {
          updateOne: {
            filter: { _id: s.taskId },
            update: {
              $set: {
                "roleAssignments.$[elem].startDate": s.startDate,
                "roleAssignments.$[elem].dueDate": s.dueDate
              }
            },
            arrayFilters: [{ "elem.role": s.roleId }]
          }
        };
      } else {
        return {
          updateOne: {
            filter: { _id: s.taskId },
            update: {
              $set: {
                startDate: s.startDate,
                dueDate: s.dueDate
              }
            }
          }
        };
      }
    });

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    res.json({ success: true, count: bulkOps.length });
  } catch (error) {
    console.error('Error in bulkScheduleTasks:', error);
    res.status(500).json({ error: error.message });
  }
};

// Bulk update role durations for multiple tasks
exports.bulkUpdateRoleDurations = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { updates, roleId, userId } = req.body; // updates: [{ taskId, duration }]

    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'Updates must be an array' });
    }

    const results = [];
    for (const update of updates) {
      if (update.duration === '' || update.duration == null) continue;

      const task = await Task.findById(update.taskId);
      if (!task || task.project.toString() !== projectId) continue;

      // Find the specific role assignment
      let ra = task.roleAssignments.find(a => a.role.toString() === roleId);

      if (!ra) {
        // Create role assignment if it doesn't exist
        task.roleAssignments.push({
          role: roleId,
          order: task.roleAssignments.length + 1,
          assignees: [],
          status: 'pending'
        });
        ra = task.roleAssignments[task.roleAssignments.length - 1];
      }

      if (ra) {
        const durationHours = parseFloat(update.duration);
        const durationMinutes = Math.round(durationHours * 60);

        ra.duration = { value: durationHours, unit: 'hours' };

        // If userId is provided, ensure they are assigned to this role
        if (userId) {
          if (!ra.assignees.some(a => a.toString() === userId)) {
            ra.assignees.push(userId);
          }
          if (!task.assignees.some(a => a.toString() === userId)) {
            task.assignees.push(userId);
          }
        }

        await task.save();

        // Also persist to TaskUserDuration for the DUR(H) column totals
        if (userId) {
          const filter = { task: task._id, taskStep: ra._id, user: userId };
          await TaskUserDuration.findOneAndUpdate(
            filter,
            { $set: { durationMinutes } },
            { upsert: true, new: true }
          );
        }

        results.push(task._id);
      }
    }

    res.json({ success: true, updatedCount: results.length });
  } catch (error) {
    console.error('Error in bulk update role durations:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /projects/:projectId/tasks/bulk-durations?userId=X&roleId=Y
 * Returns a map of { taskId: durationMinutes } for all tasks where the given
 * user has a saved duration in the given role.
 */
exports.getBulkUserDurations = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, roleId } = req.query;

    if (!userId || !roleId) {
      return res.status(400).json({ error: 'userId and roleId are required' });
    }

    // Get all tasks for the project
    const tasks = await Task.find({ project: projectId }).select('_id roleAssignments').lean();

    // Build map: roleAssignmentId -> taskId for assignments matching the requested role
    const raToTask = {};
    tasks.forEach(task => {
      task.roleAssignments?.forEach(ra => {
        const raRoleId = ra.role?.toString() || '';
        if (raRoleId === roleId) {
          raToTask[ra._id.toString()] = task._id.toString();
        }
      });
    });

    const mongoose = require('mongoose');
    const raIds = Object.keys(raToTask).map(id => new mongoose.Types.ObjectId(id));

    // Fetch TaskUserDuration records matching any of those role assignments + user
    const durations = await TaskUserDuration.find({
      taskStep: { $in: raIds },
      user: userId
    }).lean();

    // Build result map: taskId -> durationMinutes
    const result = {};
    durations.forEach(d => {
      const taskId = raToTask[d.taskStep?.toString()];
      if (taskId) {
        result[taskId] = (result[taskId] || 0) + d.durationMinutes;
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Error in getBulkUserDurations:', error);
    res.status(500).json({ error: error.message });
  }
};
// ─── Duration per member per role ────────────────────────────────────────────

/**
 * PUT /projects/:projectId/tasks/:taskId/role-duration
 *
 * Set / update duration for a task, optionally scoped to a role assignment.
 *
 * Body:
 *   durationMinutes   {number}  – duration in minutes (>= 0)  [required]
 *   roleAssignmentId  {string}  – (optional) scope to a specific role step.
 *                                  Omit to log duration at task level.
 *   targetUserId      {string}  – (optional) whose duration to set.
 *                                  Omit / pass own id → sets for yourself.
 *                                  Pass another user's id → owner/permitted only.
 *
 * Rules:
 *   • Any project member can freely add/update their OWN duration on any task.
 *   • Project owner OR a member with `editTask` permission can set duration
 *     for ANY other member on any task.
 */
exports.setRoleDuration = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { roleAssignmentId, durationMinutes, targetUserId } = req.body;

    if (
      durationMinutes === undefined ||
      durationMinutes === null ||
      isNaN(Number(durationMinutes)) ||
      Number(durationMinutes) < 0
    ) {
      return res.status(400).json({ error: 'durationMinutes must be a non-negative number' });
    }

    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const requestingUserId = req.user._id.toString();
    const subjectUserId    = targetUserId ? targetUserId.toString() : requestingUserId;
    const isTargetingSelf  = subjectUserId === requestingUserId;

    const isOwner = project.owner.toString() === requestingUserId;
    const hasEditPermission = !!(req.userPermissions && req.userPermissions.editTask);
    const isSuperAdmin = req.user.role === 'superadmin';
    const isPrivileged = isOwner || hasEditPermission || isSuperAdmin;

    // Check the requesting user is at least a project member
    const isMember = isPrivileged ||
      project.members.some(m => (m.user?._id || m.user).toString() === requestingUserId);
    if (!isMember) {
      return res.status(403).json({ error: 'Access denied. You are not a member of this project.' });
    }

    // Only owners / permitted members can set duration for someone else
    if (!isTargetingSelf && !isPrivileged) {
      return res.status(403).json({
        error: 'Only project owners or members with editTask permission can set duration for other members'
      });
    }

    // Resolve the roleAssignment step id (null = task-level duration)
    let taskStepId = null;
    if (roleAssignmentId) {
      const ra = task.roleAssignments.id(roleAssignmentId);
      if (!ra) return res.status(404).json({ error: 'Role assignment not found' });
      taskStepId = ra._id;
    }

    // Upsert the TaskUserDuration record
    const duration = await TaskUserDuration.findOneAndUpdate(
      { task: taskId, taskStep: taskStepId, user: subjectUserId },
      { task: taskId, taskStep: taskStepId, user: subjectUserId, durationMinutes: Number(durationMinutes) },
      { upsert: true, new: true }
    ).populate('user', 'name email profile');

    res.json({ success: true, duration });
  } catch (error) {
    console.error('Error setting role duration:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /projects/:projectId/tasks/:taskId/durations
 *
 * Retrieve all duration records for a task, grouped by role assignment.
 *
 * Rules:
 *   • Project owner / editTask permission → sees ALL members' durations.
 *   • Regular member → sees only their own durations.
 */
exports.getTaskDurations = async (req, res) => {
  try {
    const { taskId } = req.params;

    const task = await Task.findById(taskId).lean();
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const requestingUserId = req.user._id.toString();
    const isOwner = project.owner.toString() === requestingUserId;
    const hasEditPermission = !!(req.userPermissions && req.userPermissions.editTask);
    const isSuperAdmin = req.user.role === 'superadmin';
    const isPrivileged = isOwner || hasEditPermission || isSuperAdmin;

    // Build query – privileged users see everyone, others see only themselves
    const query = { task: taskId };
    if (!isPrivileged) query.user = req.user._id;

    const durations = await TaskUserDuration.find(query)
      .populate('user', 'name email profile')
      .lean();

    // Group by roleAssignment id for easy frontend consumption
    const grouped = {};
    for (const ra of (task.roleAssignments || [])) {
      grouped[ra._id.toString()] = {
        roleAssignmentId: ra._id,
        role: ra.role,
        members: []
      };
    }

    for (const d of durations) {
      const raId = d.taskStep ? d.taskStep.toString() : '__task__';
      if (!grouped[raId]) grouped[raId] = { roleAssignmentId: raId, role: null, members: [] };
      grouped[raId].members.push({
        user: d.user,
        durationMinutes: d.durationMinutes,
        updatedAt: d.updatedAt
      });
    }

    res.json({ taskId, durations: Object.values(grouped) });
  } catch (error) {
    console.error('Error getting task durations:', error);
    res.status(500).json({ error: error.message });
  }
};

// Bulk assign a member to all tasks in a project with specified roles
exports.bulkAssignMemberToAllTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId, roleIds } = req.body;

    if (!userId || !roleIds || !Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'userId and roleIds (array) are required' });
    }

    // Verify project access
    const project = await (require('../models/Project')).findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString());

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const Task = require('../models/Task');
    // Get all tasks for this project
    const tasks = await Task.find({ project: projectId });

    const bulkOps = tasks.map(task => {
      let roleAssignments = task.roleAssignments ? [...task.roleAssignments] : [];

      // For each requested role ID
      roleIds.forEach(roleId => {
        let ra = roleAssignments.find(a => a.role && a.role.toString() === roleId);
        if (!ra) {
          // If role assignment doesn't exist, create it
          roleAssignments.push({
            role: roleId,
            order: roleAssignments.length + 1,
            assignees: [userId],
            status: 'pending'
          });
        } else {
          // If it exists, add user if not already there
          if (!ra.assignees.some(a => a.toString() === userId)) {
            ra.assignees.push(userId);
          }
        }
      });

      // Update flat assignees as well
      const assignees = task.assignees ? [...task.assignees] : [];
      if (!assignees.some(a => a.toString() === userId)) {
        assignees.push(userId);
      }

      return {
        updateOne: {
          filter: { _id: task._id },
          update: {
            $set: {
              roleAssignments,
              assignees,
              useRoleWorkflow: roleAssignments.length > 0
            }
          }
        }
      };
    });

    if (bulkOps.length > 0) {
      await Task.bulkWrite(bulkOps);
    }

    res.json({ success: true, count: bulkOps.length });
  } catch (error) {
    console.error('Error in bulkAssignMemberToAllTasks:', error);
    res.status(500).json({ error: error.message });
  }
};
