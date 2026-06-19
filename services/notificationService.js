const Notification = require('../models/Notification');
const ApiError = require('../utils/ApiError');

const getUserNotifications = async (userId, companyId) => {
  const filter = { user: userId };
  if (companyId) filter.company = companyId;

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).limit(50),
    Notification.countDocuments({ ...filter, isRead: false })
  ]);

  return { notifications, unreadCount };
};

const markAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw ApiError.notFound('Notification not found');
  if (notification.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized');
  }
  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
};

const markAllAsRead = async (userId) => {
  await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return { message: 'All notifications marked as read' };
};

const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) throw ApiError.notFound('Notification not found');
  if (notification.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Unauthorized');
  }
  await Notification.findByIdAndDelete(notificationId);
  return { message: 'Notification deleted successfully' };
};

module.exports = {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification
};
