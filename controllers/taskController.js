const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');
const User = require('../models/User');
const TaskRole = require('../models/TaskRole');
const Notification = require('../models/Notification');
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
    else if (project.members.some(member => member.user && member.user.equals(req.user._id))) {
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
      .populate('assignees', 'name email')
      .populate('createdBy', 'name')
      .populate('status', 'name color')
      .populate('parent', 'title')
      .populate('sprint', 'name sprintNumber')
      .populate('phase', 'name')
      .populate('roleAssignments.role', 'name color icon order')
      .populate('roleAssignments.assignees', 'name email avatar')
      .populate('roleAssignments.handoff.handoffBy', 'name email')
      .sort({ order: 1, createdAt: 1 });
    
    // Build hierarchical structure
    const taskMap = new Map();
    const rootTasks = [];
    
    tasks.forEach(task => {
      taskMap.set(task._id.toString(), { ...task.toObject(), subtasks: [] });
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
                     project.members.some(member => member.equals(req.user._id)) ||
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
    await task.populate('assignees', 'name email');
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
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project access
    const project = await Project.findById(task.project);
    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id)) ||
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
    await task.populate('assignees', 'name email');
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
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Verify project access
    const project = await Project.findById(task.project);
    const user = await User.findById(req.user._id).populate('company');
    const isSuperAdmin = user.role === 'superadmin';
    const isCompanyCreator = project.company && user.company && user.company.owner && user.company.owner.toString() === req.user._id;
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id)) ||
                     isSuperAdmin || isCompanyCreator;
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Task.findByIdAndDelete(req.params.id);
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
                     project.members.some(member => member.equals(req.user._id)) ||
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
      .populate('assignees', 'name email')
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
  await task.populate('assignees', 'name email avatar');
  await task.populate('createdBy', 'name email');
  await task.populate('status', 'name color');
  await task.populate('parent', 'title');
  await task.populate('sprint', 'name sprintNumber');
  await task.populate('phase', 'name');
  await task.populate('roleAssignments.role', 'name color icon order');
  await task.populate('roleAssignments.assignees', 'name email avatar');
  await task.populate('roleAssignments.handoff.handoffBy', 'name email');
  return task;
};

// Helper function to send role notifications
const sendRoleNotification = async (type, userId, task, role, handoffData = null, fromUser = null) => {
  const notification = new Notification({
    user: userId,
    type,
    title: type === 'task_role_assignment'
      ? `Assigned to role: ${role.name}`
      : type === 'task_role_handoff'
        ? `Role handoff: ${role.name}`
        : `Role completed: ${role.name}`,
    message: type === 'task_role_assignment'
      ? `You have been assigned to the "${role.name}" role for task "${task.title}"`
      : type === 'task_role_handoff'
        ? `The "${role.name}" role is now ready for you on task "${task.title}"`
        : `Your role "${role.name}" has been completed on task "${task.title}"`,
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
      return res.status(400).json({ error: 'Workflow already started' });
    }

    // Activate first role
    task.currentRoleIndex = 0;
    task.roleAssignments[0].status = 'active';
    task.roleAssignments[0].startedAt = new Date();

    await task.save();
    await populateTask(task);

    // Notify assignees of first role
    const firstRole = task.roleAssignments[0];
    for (const assignee of firstRole.assignees) {
      await sendRoleNotification('task_role_assignment', assignee._id, task, firstRole.role);
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
      const nextRole = task.roleAssignments[nextRoleIndex];
      for (const assignee of nextRole.assignees) {
        await sendRoleNotification(
          'task_role_handoff',
          assignee._id,
          task,
          nextRole.role,
          currentRole.handoff,
          req.user._id
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
                     project.members.some(member => member.user && member.user.equals(req.user._id));

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
        status: 'pending'
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