const asyncHandler = require('../utils/asyncHandler');
const notificationService = require('../services/notificationService');

exports.getUserNotifications = asyncHandler(async (req, res) => {
  const companyId = req.headers['x-company-id'] || req.query.companyId || null;
  const result = await notificationService.getUserNotifications(req.user._id, companyId);
  res.json(result);
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await notificationService.markAsRead(req.params.notificationId, req.user._id);
  res.json(notification);
});

exports.markAllAsRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markAllAsRead(req.user._id);
  res.json(result);
});

exports.deleteNotification = asyncHandler(async (req, res) => {
  const result = await notificationService.deleteNotification(req.params.notificationId, req.user._id);
  res.json(result);
});

