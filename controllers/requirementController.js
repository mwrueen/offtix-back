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

// Upload attachment to requirement
exports.uploadAttachment = async (req, res) => {
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

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const attachment = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/requirement-files/${req.file.filename}`,
      size: req.file.size,
      uploadedBy: req.user._id,
      uploadedAt: new Date()
    };

    requirement.attachments.push(attachment);
    await requirement.save();
    await requirement.populate('createdBy', 'name email');
    await requirement.populate('assignedTo', 'name email');

    res.json({ message: 'File uploaded successfully', requirement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete attachment from requirement
exports.deleteAttachment = async (req, res) => {
  try {
    const { projectId, requirementId, attachmentId } = req.params;

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

    const attachmentIndex = requirement.attachments.findIndex(
      a => a._id.toString() === attachmentId
    );

    if (attachmentIndex === -1) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Remove file from filesystem
    const fs = require('fs');
    const path = require('path');
    const attachment = requirement.attachments[attachmentIndex];
    const filePath = path.join(__dirname, '..', attachment.path);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    requirement.attachments.splice(attachmentIndex, 1);
    await requirement.save();
    await requirement.populate('createdBy', 'name email');
    await requirement.populate('assignedTo', 'name email');

    res.json({ message: 'Attachment deleted successfully', requirement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};