const Message = require('../models/Message');
const Project = require('../models/Project');
const User = require('../models/User');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const buildMessageQuery = ({ projectId, companyId, dmWithId, userId }) => {
  const query = { isDeleted: false };
  if (projectId) query.project = projectId;
  else if (companyId) query.company = companyId;
  else if (dmWithId) {
    query.$or = [
      { sender: userId, recipient: dmWithId },
      { sender: dmWithId, recipient: userId }
    ];
  }
  return query;
};

const verifyChatContext = async ({ projectId, companyId, dmWithId }, userId) => {
  if (projectId) {
    const project = await Project.findOne({
      _id: projectId,
      $or: [{ owner: userId }, { 'members.user': userId }]
    });
    if (!project) throw ApiError.forbidden('Access denied');
  } else if (companyId) {
    const user = await User.findById(userId);
    if (!user?.company || user.company.toString() !== companyId) {
      throw ApiError.forbidden('Access denied');
    }
  } else if (!dmWithId) {
    throw ApiError.badRequest('Missing chat context');
  }
};

const getMessages = async ({ projectId, companyId, dmWithId, userId }, { page, limit, before }) => {
  const context = { userId, projectId, companyId, dmWithId };
  await verifyChatContext(context, userId);
  const messages = await Message.getMessages(context, { page, limit, before });
  const query = buildMessageQuery(context);
  const total = await Message.countDocuments(query);
  return {
    messages,
    pagination: {
      page,
      limit,
      total,
      hasMore: total > page * limit
    }
  };
};

const getMembers = async ({ projectId, companyId }) => {
  if (projectId) {
    const project = await Project.findById(projectId)
      .populate('owner', 'name email profile.profilePicture')
      .populate('members.user', 'name email profile.profilePicture');
    if (!project) throw ApiError.notFound('Project not found');
    const members = [
      { _id: project.owner._id, name: project.owner.name, email: project.owner.email, avatar: project.owner.profile?.profilePicture, role: 'Owner' },
      ...project.members.map((m) => ({ _id: m.user._id, name: m.user.name, email: m.user.email, avatar: m.user.profile?.profilePicture, role: m.role }))
    ];
    return members.filter((m, i, s) => i === s.findIndex((u) => u._id.toString() === m._id.toString()));
  }
  if (companyId) {
    const users = await User.find({ company: companyId }).select('name email profile.profilePicture role');
    return users.map((u) => ({ _id: u._id, name: u.name, email: u.email, avatar: u.profile?.profilePicture, role: u.role }));
  }
  throw ApiError.badRequest('Missing context');
};

const deleteMessage = async (projectId, messageId, userId) => {
  const message = await Message.findOne({ _id: messageId, project: projectId });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.sender.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only delete your own messages');
  }
  message.isDeleted = true;
  message.deletedAt = new Date();
  await message.save();
  return { message: 'Message deleted successfully' };
};

const editMessage = async (projectId, messageId, userId, content) => {
  const message = await Message.findOne({ _id: messageId, project: projectId });
  if (!message) throw ApiError.notFound('Message not found');
  if (message.sender.toString() !== userId.toString()) {
    throw ApiError.forbidden('You can only edit your own messages');
  }
  const fiveMinutes = 5 * 60 * 1000;
  if (Date.now() - message.createdAt.getTime() > fiveMinutes) {
    throw ApiError.badRequest('Message can only be edited within 5 minutes');
  }
  message.content = content;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();
  await message.populate('sender', 'name email profile.profilePicture');
  return message;
};

const getUnreadCounts = async (userId, companyId) => {
  const dmMatch = {
    recipient: userId,
    isDeleted: false,
    'readBy.user': { $ne: userId }
  };
  const dmPipeline = [{ $match: dmMatch }];
  if (companyId) {
    dmPipeline.push(
      { $lookup: { from: 'users', localField: 'sender', foreignField: '_id', as: 'senderUser' } },
      { $unwind: '$senderUser' },
      { $match: { 'senderUser.company': new mongoose.Types.ObjectId(companyId) } }
    );
  }
  dmPipeline.push({ $group: { _id: '$sender', count: { $sum: 1 } } });
  const dmUnread = await Message.aggregate(dmPipeline);

  const projectFilter = { $or: [{ owner: userId }, { 'members.user': userId }] };
  if (companyId) projectFilter.company = companyId;
  const userProjects = await Project.find(projectFilter).select('_id');
  const projectIds = userProjects.map((p) => p._id);
  const projectUnread = await Message.aggregate([
    {
      $match: {
        project: { $in: projectIds },
        sender: { $ne: userId },
        isDeleted: false,
        'readBy.user': { $ne: userId }
      }
    },
    { $group: { _id: '$project', count: { $sum: 1 } } }
  ]);

  return {
    direct: dmUnread.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    projects: projectUnread.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    total: dmUnread.reduce((a, b) => a + b.count, 0) + projectUnread.reduce((a, b) => a + b.count, 0)
  };
};

const markMessagesAsRead = async (userId, { projectId, dmWithId }) => {
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
    throw ApiError.badRequest('Missing chat context (projectId or dmWithId)');
  }
  await Message.updateMany(query, { $push: { readBy: { user: userId, readAt: new Date() } } });
  return { success: true };
};

module.exports = { getMessages, getMembers, deleteMessage, editMessage, getUnreadCounts, markMessagesAsRead };
