const Task = require('../models/Task');
const Project = require('../models/Project');
const TaskStatus = require('../models/TaskStatus');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Helper function to check if task dependencies allow status change
const checkTaskDependencies = async (taskId, newStatusId) => {
  try {
    const task = await Task.findById(taskId).populate('dependencies', 'title status');
    if (!task || !task.dependencies || task.dependencies.length === 0) {
      return { canChange: true };
    }

    // Get the new status to check if it's a "completed" type status
    const newStatus = await TaskStatus.findById(newStatusId);
    if (!newStatus) {
      return { canChange: true };
    }

    // Get all statuses for this project to determine completion status
    const allStatuses = await TaskStatus.find({ project: task.project }).sort({ order: 1 });
    const completedStatuses = allStatuses.slice(-1); // Assume last status is completed
    const isMovingToCompleted = completedStatuses.some(s => s._id.equals(newStatusId));

    if (!isMovingToCompleted) {
      return { canChange: true };
    }

    // Check if all dependencies are completed
    const incompleteDependencies = [];
    for (const dep of task.dependencies) {
      const isDepCompleted = completedStatuses.some(s => 
        dep.status && s._id.equals(dep.status._id || dep.status)
      );
      if (!isDepCompleted) {
        incompleteDependencies.push(dep);
      }
    }

    if (incompleteDependencies.length > 0) {
      return {
        canChange: false,
        message: `Cannot complete task. The following dependencies must be completed first: ${incompleteDependencies.map(d => d.title).join(', ')}`,
        blockedBy: incompleteDependencies
      };
    }

    return { canChange: true };
  } catch (error) {
    console.error('Error checking dependencies:', error);
    return { canChange: true }; // Allow change if there's an error
  }
};

exports.getTasks = async (req, res) => {
  try {
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

    const tasks = await Task.find({ project: projectId })
      .populate('assignees', 'name email')
      .populate('dependencies', 'title status')
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

    const task = new Task({
      ...req.body,
      project: projectId,
      createdBy: req.user._id
    });
    
    await task.save();
    await task.populate('assignees', 'name email');
    await task.populate('dependencies', 'title');
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

    // Check dependency constraints if status is being changed
    if (req.body.status && req.body.status !== task.status?.toString()) {
      const dependencyCheck = await checkTaskDependencies(req.params.id, req.body.status);
      if (!dependencyCheck.canChange) {
        return res.status(400).json({ 
          error: 'Cannot change task status', 
          message: dependencyCheck.message,
          blockedBy: dependencyCheck.blockedBy
        });
      }
    }

    Object.assign(task, req.body);
    await task.save();
    await task.populate('assignees', 'name email');
    await task.populate('dependencies', 'title status');
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

exports.checkStatusChange = async (req, res) => {
  try {
    const { taskId, statusId } = req.params;
    
    const task = await Task.findById(taskId);
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

    const dependencyCheck = await checkTaskDependencies(taskId, statusId);
    res.json(dependencyCheck);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};