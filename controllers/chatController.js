const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');

// Get messages for a context (project, company, or DM)
exports.getMessages = async (req, res) => {
  try {
    const { projectId, companyId, dmWithId } = req.query;
    const { page = 1, limit = 50, before } = req.query;

    const context = { userId: req.user._id };

    if (projectId) {
      const project = await Project.findOne({
        _id: projectId,
        $or: [{ owner: req.user._id }, { 'members.user': req.user._id }]
      });
      if (!project) return res.status(403).json({ message: 'Access denied' });
      context.projectId = projectId;
    } else if (companyId) {
      if (!req.user.company || req.user.company.toString() !== companyId) {
        return res.status(403).json({ message: 'Access denied' });
      }
      context.companyId = companyId;
    } else if (dmWithId) {
      context.dmWithId = dmWithId;
    } else {
      return res.status(400).json({ message: 'Missing chat context' });
    }

    const messages = await Message.getMessages(context, {
      page: parseInt(page),
      limit: parseInt(limit),
      before
    });

    const query = { isDeleted: false };
    if (projectId) query.project = projectId;
    else if (companyId) query.company = companyId;
    else if (dmWithId) {
      query.$or = [
        { sender: req.user._id, recipient: dmWithId },
        { sender: dmWithId, recipient: req.user._id }
      ];
    }

    const total = await Message.countDocuments(query);

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

// Get members (project OR company)
exports.getMembers = async (req, res) => {
  try {
    const { projectId, companyId } = req.query;

    if (projectId) {
      const project = await Project.findById(projectId)
        .populate('owner', 'name email profile.profilePicture')
        .populate('members.user', 'name email profile.profilePicture');

      if (!project) return res.status(404).json({ message: 'Project not found' });

      const members = [
        { _id: project.owner._id, name: project.owner.name, email: project.owner.email, avatar: project.owner.profile?.profilePicture, role: 'Owner' },
        ...project.members.map(m => ({ _id: m.user._id, name: m.user.name, email: m.user.email, avatar: m.user.profile?.profilePicture, role: m.role }))
      ];
      return res.json(members.filter((m, i, s) => i === s.findIndex(u => u._id.toString() === m._id.toString())));
    }

    if (companyId) {
      const users = await User.find({ company: companyId }).select('name email profile.profilePicture role');
      return res.json(users.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        avatar: u.profile?.profilePicture,
        role: u.role
      })));
    }

    res.status(400).json({ message: 'Missing context' });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Failed to fetch members' });
  }
};

// Legacy compatibility
exports.getProjectMembers = exports.getMembers;

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

// Get unread message counts for the current user
exports.getUnreadCounts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Direct Messages unread counts
    const dmUnread = await Message.aggregate([
      {
        $match: {
          recipient: userId,
          isDeleted: false,
          'readBy.user': { $ne: userId }
        }
      },
      {
        $group: {
          _id: '$sender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Project Messages unread counts
    // First find all projects user is part of
    const userProjects = await Project.find({
      $or: [{ owner: userId }, { 'members.user': userId }]
    }).select('_id');
    const projectIds = userProjects.map(p => p._id);

    const projectUnread = await Message.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          sender: { $ne: userId },
          isDeleted: false,
          'readBy.user': { $ne: userId }
        }
      },
      {
        $group: {
          _id: '$project',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      direct: dmUnread.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      projects: projectUnread.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
      total: dmUnread.reduce((a, b) => a + b.count, 0) + projectUnread.reduce((a, b) => a + b.count, 0)
    });
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.status(500).json({ message: 'Failed to fetch unread counts' });
  }
};

// Mark messages as read in a specific context
exports.markMessagesAsRead = async (req, res) => {
  try {
    const { projectId, dmWithId } = req.body;
    const userId = req.user._id;

    console.log('markMessagesAsRead request:', { projectId, dmWithId, userId });

    const query = {
      isDeleted: false,
      'readBy.user': { $ne: userId }
    };

    if (projectId) {
      query.project = projectId;
      query.sender = { $ne: userId };
    } else if (dmWithId) {
      query.sender = dmWithId;
      query.recipient = userId;
    } else {
      console.log('markMessagesAsRead missing context:', req.body);
      return res.status(400).json({ message: 'Missing chat context (projectId or dmWithId)' });
    }

    await Message.updateMany(query, {
      $push: { readBy: { user: userId, readAt: new Date() } }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
};
