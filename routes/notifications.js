const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get user's notifications
router.get('/', notificationController.getUserNotifications);

// Mark ALL notifications as read  — must come BEFORE /:notificationId routes
router.put('/mark-all-read', notificationController.markAllAsRead);
router.patch('/mark-all-read', notificationController.markAllAsRead);

// Mark a single notification as read
router.put('/:notificationId/read', notificationController.markAsRead);
router.patch('/:notificationId/read', notificationController.markAsRead);

// Delete notification
router.delete('/:notificationId', notificationController.deleteNotification);

module.exports = router;
