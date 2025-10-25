const Phase = require('../models/Phase');
const Project = require('../models/Project');

exports.getPhases = async (req, res) => {
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

    let phases = await Phase.find({ project: projectId }).sort({ order: 1 });
    
    // Create default phases if none exist
    if (phases.length === 0) {
      const defaultPhases = [
        { name: 'Planning', order: 0, project: projectId },
        { name: 'Development', order: 1, project: projectId },
        { name: 'Testing', order: 2, project: projectId },
        { name: 'Deployment', order: 3, project: projectId }
      ];
      
      phases = await Phase.insertMany(defaultPhases);
    }
    
    res.json(phases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPhase = async (req, res) => {
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

    const phase = new Phase({
      ...req.body,
      project: projectId
    });
    
    await phase.save();
    res.status(201).json(phase);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};