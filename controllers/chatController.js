const asyncHandler = require('../utils/asyncHandler');
const chatService = require('../services/chatService');

exports.getMessages = asyncHandler(async (req, res) => {
  const { projectId, companyId, dmWithId, page = 1, limit = 50, before } = req.query;
  const result = await chatService.getMessages(
    { projectId, companyId, dmWithId, userId: req.user._id },
    { page: parseInt(page, 10), limit: parseInt(limit, 10), before }
  );
  res.json(result);
});

exports.getMembers = asyncHandler(async (req, res) => {
  const { projectId, companyId } = req.query;
  const members = await chatService.getMembers({ projectId, companyId });
  res.json(members);
});

exports.getProjectMembers = exports.getMembers;

exports.deleteMessage = asyncHandler(async (req, res) => {
  const result = await chatService.deleteMessage(req.params.projectId, req.params.messageId, req.user._id);
  const io = req.app.get('io');
  io.to(`project:${req.params.projectId}`).emit('message-deleted', { messageId: req.params.messageId });
  res.json(result);
});

exports.editMessage = asyncHandler(async (req, res) => {
  const message = await chatService.editMessage(req.params.projectId, req.params.messageId, req.user._id, req.body.content);
  const io = req.app.get('io');
  io.to(`project:${req.params.projectId}`).emit('message-edited', message);
  res.json(message);
});

exports.getUnreadCounts = asyncHandler(async (req, res) => {
  const companyId = req.headers['x-company-id'] || req.query.companyId || null;
  const counts = await chatService.getUnreadCounts(req.user._id, companyId);
  res.json(counts);
});

exports.markMessagesAsRead = asyncHandler(async (req, res) => {
  const result = await chatService.markMessagesAsRead(req.user._id, req.body);
  res.json(result);
});
