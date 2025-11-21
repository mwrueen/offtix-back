const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');
const User = require('../models/User');
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