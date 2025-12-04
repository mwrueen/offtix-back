const express = require('express');
const router = express.Router({ mergeParams: true });
const chatController = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get messages for a project
router.get('/messages', chatController.getMessages);

// Get project members for mentions
router.get('/members', chatController.getProjectMembers);

// Delete a message
router.delete('/messages/:messageId', chatController.deleteMessage);

// Edit a message
router.put('/messages/:messageId', chatController.editMessage);

module.exports = router;

