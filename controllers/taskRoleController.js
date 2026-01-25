const TaskRole = require('../models/TaskRole');
const Project = require('../models/Project');

// Get all workflow roles for a project
exports.getProjectRoles = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const roles = await TaskRole.find({ project: projectId, isActive: true })
      .populate('defaultAssignees', 'name email avatar')
      .populate('createdBy', 'name email')
      .sort({ order: 1 });
    
    res.json(roles);
  } catch (error) {
    console.error('Error fetching task roles:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create a new workflow role
exports.createRole = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, description, color, icon, defaultAssignees, estimatedDuration } = req.body;
    
    // Verify project access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if user is project owner or has permission
    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can create workflow roles' });
    }
    
    // Get the next order number
    const lastRole = await TaskRole.findOne({ project: projectId }).sort({ order: -1 });
    const order = lastRole ? lastRole.order + 1 : 1;
    
    const role = new TaskRole({
      name,
      description,
      color,
      icon,
      order,
      defaultAssignees: defaultAssignees || [],
      estimatedDuration,
      project: projectId,
      createdBy: req.user._id
    });
    
    await role.save();
    await role.populate('defaultAssignees', 'name email avatar');
    await role.populate('createdBy', 'name email');
    
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creating task role:', error);
    res.status(400).json({ error: error.message });
  }
};

// Update a workflow role
exports.updateRole = async (req, res) => {
  try {
    const { projectId, roleId } = req.params;
    const updates = req.body;
    
    const role = await TaskRole.findOne({ _id: roleId, project: projectId });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Verify project ownership
    const project = await Project.findById(projectId);
    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can update workflow roles' });
    }
    
    Object.assign(role, updates);
    await role.save();
    await role.populate('defaultAssignees', 'name email avatar');
    await role.populate('createdBy', 'name email');
    
    res.json(role);
  } catch (error) {
    console.error('Error updating task role:', error);
    res.status(400).json({ error: error.message });
  }
};

// Delete (deactivate) a workflow role
exports.deleteRole = async (req, res) => {
  try {
    const { projectId, roleId } = req.params;
    
    const role = await TaskRole.findOne({ _id: roleId, project: projectId });
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Verify project ownership
    const project = await Project.findById(projectId);
    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can delete workflow roles' });
    }
    
    // Soft delete by setting isActive to false
    role.isActive = false;
    await role.save();
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting task role:', error);
    res.status(500).json({ error: error.message });
  }
};

// Reorder workflow roles
exports.reorderRoles = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { roleOrders } = req.body; // Array of { roleId, order }

    // Verify project ownership
    const project = await Project.findById(projectId);
    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can reorder workflow roles' });
    }

    const updatePromises = roleOrders.map(({ roleId, order }) =>
      TaskRole.findByIdAndUpdate(roleId, { order }, { new: true })
    );

    await Promise.all(updatePromises);

    const roles = await TaskRole.find({ project: projectId, isActive: true })
      .populate('defaultAssignees', 'name email avatar')
      .sort({ order: 1 });

    res.json(roles);
  } catch (error) {
    console.error('Error reordering task roles:', error);
    res.status(500).json({ error: error.message });
  }
};

// Initialize default workflow roles for a project
exports.initializeDefaultRoles = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify project ownership
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const isOwner = project.owner.toString() === req.user._id.toString();
    if (!isOwner) {
      return res.status(403).json({ error: 'Only project owner can initialize workflow roles' });
    }

    // Check if roles already exist
    const existingRoles = await TaskRole.countDocuments({ project: projectId, isActive: true });
    if (existingRoles > 0) {
      return res.status(400).json({ error: 'Workflow roles already exist for this project' });
    }

    // Create default roles
    const defaultRoles = TaskRole.getDefaultRoles();
    const createdRoles = await Promise.all(
      defaultRoles.map(roleData =>
        TaskRole.create({
          ...roleData,
          project: projectId,
          createdBy: req.user._id
        })
      )
    );

    res.status(201).json(createdRoles);
  } catch (error) {
    console.error('Error initializing default roles:', error);
    res.status(500).json({ error: error.message });
  }
};

