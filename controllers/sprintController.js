const Sprint = require('../models/Sprint');
const Project = require('../models/Project');

exports.getSprints = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let sprints = await Sprint.find({ project: projectId }).sort({ sprintNumber: 1 });
    
    // Create default sprints if none exist
    if (sprints.length === 0) {
      const now = new Date();
      const defaultSprints = [
        {
          name: 'Sprint 1',
          sprintNumber: 1,
          startDate: now,
          endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
          project: projectId
        },
        {
          name: 'Sprint 2',
          sprintNumber: 2,
          startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 28 * 24 * 60 * 60 * 1000), // 4 weeks
          project: projectId
        }
      ];
      
      sprints = await Sprint.insertMany(defaultSprints);
    }
    
    res.json(sprints);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createSprint = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const sprint = new Sprint({
      ...req.body,
      project: projectId
    });
    
    await sprint.save();
    res.status(201).json(sprint);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};