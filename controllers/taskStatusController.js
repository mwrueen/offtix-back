const TaskStatus = require('../models/TaskStatus');
const Project = require('../models/Project');

exports.getTaskStatuses = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let statuses = await TaskStatus.find({ project: projectId }).sort({ order: 1 });
    
    // Create default statuses if none exist
    if (statuses.length === 0) {
      const defaultStatuses = [
        { name: 'To Do', color: '#fbbf24', order: 0, project: projectId },
        { name: 'In Progress', color: '#3b82f6', order: 1, project: projectId },
        { name: 'Review', color: '#8b5cf6', order: 2, project: projectId },
        { name: 'Completed', color: '#10b981', order: 3, project: projectId }
      ];
      
      statuses = await TaskStatus.insertMany(defaultStatuses);
    }
    
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createTaskStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project access - only project owner can manage statuses
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can manage task statuses' });
    }

    // Get the highest order number and increment
    const maxOrder = await TaskStatus.findOne({ project: projectId }).sort({ order: -1 });
    const order = maxOrder ? maxOrder.order + 1 : 0;

    const status = new TaskStatus({
      ...req.body,
      project: projectId,
      order
    });
    
    await status.save();
    res.status(201).json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { projectId, statusId } = req.params;
    
    // Verify project access - only project owner can manage statuses
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can manage task statuses' });
    }

    const status = await TaskStatus.findOneAndUpdate(
      { _id: statusId, project: projectId },
      req.body,
      { new: true }
    );

    if (!status) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTaskStatus = async (req, res) => {
  try {
    const { projectId, statusId } = req.params;
    
    // Verify project access - only project owner can manage statuses
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can manage task statuses' });
    }

    // Check if any tasks are using this status
    const Task = require('../models/Task');
    const tasksUsingStatus = await Task.countDocuments({ status: statusId });
    
    if (tasksUsingStatus > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete status that is being used by tasks',
        tasksCount: tasksUsingStatus
      });
    }

    const status = await TaskStatus.findOneAndDelete({ _id: statusId, project: projectId });
    
    if (!status) {
      return res.status(404).json({ error: 'Task status not found' });
    }

    res.json({ message: 'Task status deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};