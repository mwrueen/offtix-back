const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');

// Get messages for a project
exports.getMessages = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50, before } = req.query;
    
    // Verify user has access to project
    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { owner: req.user._id },
        { 'members.user': req.user._id }
      ]
    });
    
    if (!project) {
      return res.status(403).json({ message: 'Access denied to this project' });
    }
    
    const messages = await Message.getProjectMessages(projectId, {
      page: parseInt(page),
      limit: parseInt(limit),
      before
    });
    
    // Get total count for pagination
    const total = await Message.countDocuments({
      project: projectId,
      isDeleted: false
    });
    
    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        hasMore: total > page * limit
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// Get project members for mentions
exports.getProjectMembers = async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const project = await Project.findById(projectId)
      .populate('owner', 'name email profile.profilePicture')
      .populate('members.user', 'name email profile.profilePicture');
    
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Check if user has access
    const isOwner = project.owner._id.toString() === req.user._id.toString();
    const isMember = project.members.some(m => m.user._id.toString() === req.user._id.toString());
    
    if (!isOwner && !isMember) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Combine owner and members
    const members = [
      {
        _id: project.owner._id,
        name: project.owner.name,
        email: project.owner.email,
        avatar: project.owner.profile?.profilePicture,
        role: 'Owner'
      },
      ...project.members.map(m => ({
        _id: m.user._id,
        name: m.user.name,
        email: m.user.email,
        avatar: m.user.profile?.profilePicture,
        role: m.role
      }))
    ];
    
    // Remove duplicates (in case owner is also in members)
    const uniqueMembers = members.filter((member, index, self) =>
      index === self.findIndex(m => m._id.toString() === member._id.toString())
    );
    
    res.json(uniqueMembers);
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ message: 'Failed to fetch project members' });
  }
};

// Delete a message (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { projectId, messageId } = req.params;
    
    const message = await Message.findOne({
      _id: messageId,
      project: projectId
    });
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Only sender can delete their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    io.to(`project:${projectId}`).emit('message-deleted', { messageId });
    
    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Failed to delete message' });
  }
};

// Edit a message
exports.editMessage = async (req, res) => {
  try {
    const { projectId, messageId } = req.params;
    const { content } = req.body;
    
    const message = await Message.findOne({
      _id: messageId,
      project: projectId
    });
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    // Only sender can edit their message
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }
    
    // Check if message is within edit window (5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > fiveMinutes) {
      return res.status(400).json({ message: 'Message can only be edited within 5 minutes' });
    }
    
    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();
    
    await message.populate('sender', 'name email profile.profilePicture');
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    io.to(`project:${projectId}`).emit('message-edited', message);
    
    res.json(message);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Failed to edit message' });
  }
};

