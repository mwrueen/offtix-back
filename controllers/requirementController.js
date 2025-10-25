const Requirement = require('../models/Requirement');
const Project = require('../models/Project');
const { validationResult } = require('express-validator');

exports.getRequirements = async (req, res) => {
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

    const requirements = await Requirement.find({ project: projectId })
      .populate('createdBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('comments.author', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createRequirement = async (req, res) => {
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
    
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const requirement = new Requirement({
      ...req.body,
      project: projectId,
      createdBy: req.user._id
    });
    
    await requirement.save();
    await requirement.populate('createdBy', 'name email');
    await requirement.populate('assignedTo', 'name email');
    
    res.status(201).json(requirement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateRequirement = async (req, res) => {
  try {
    const { projectId, requirementId } = req.params;
    
    const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
    
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    Object.assign(requirement, req.body);
    await requirement.save();
    await requirement.populate('createdBy', 'name email');
    await requirement.populate('assignedTo', 'name email');
    
    res.json(requirement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteRequirement = async (req, res) => {
  try {
    const { projectId, requirementId } = req.params;
    
    const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
    
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await Requirement.findByIdAndDelete(requirementId);
    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { projectId, requirementId } = req.params;
    const { content } = req.body;
    
    const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
    
    if (!requirement) {
      return res.status(404).json({ error: 'Requirement not found' });
    }

    // Verify project access
    const project = await Project.findById(projectId);
    const hasAccess = project.owner.equals(req.user._id) || 
                     project.members.some(member => member.equals(req.user._id));
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    requirement.comments.push({
      content,
      author: req.user._id
    });

    await requirement.save();
    await requirement.populate('comments.author', 'name email');
    
    res.json(requirement);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};