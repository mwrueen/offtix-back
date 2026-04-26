const express = require('express');
const router = express.Router();
const myTasksController = require('../controllers/myTasksController');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const uploadTaskDocuments = require('../middleware/uploadTaskDocuments');

router.use(authenticate);

// Get all tasks assigned to logged-in user
router.get('/', myTasksController.getMyTasks);

// Get single task details
router.get('/:taskId', myTasksController.getMyTaskDetails);

// Set/update user's duration
router.post('/:taskId/duration', [
  body('duration_minutes')
    .isNumeric()
    .withMessage('Duration must be a number')
    .isFloat({ min: 0 })
    .withMessage('Duration must be positive')
], myTasksController.setDuration);

// Start task step
router.post('/:taskId/start', myTasksController.startTask);

// Pause task
router.post('/:taskId/pause', myTasksController.pauseTask);

// Complete task step
router.post('/:taskId/complete', uploadTaskDocuments.array('files', 10), [
  body('note')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Completion note is required')
], myTasksController.completeTask);

// Send back for fix
router.post('/:taskId/send-back', [
  body('note')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Note is required'),
  body('message')
    .optional()
    .trim()
], myTasksController.sendBackForFix);

// Sequential workflow routes
router.post('/:taskId/sequential/start', myTasksController.startSequentialTask);
router.post('/:taskId/sequential/pause', myTasksController.pauseSequentialTask);
router.post('/:taskId/sequential/complete', uploadTaskDocuments.array('files', 10), [
  body('note')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Completion note is required')
], myTasksController.completeSequentialTask);
router.post('/:taskId/sequential/send-back', uploadTaskDocuments.array('files', 10), myTasksController.sendBackSequentialTask);

module.exports = router;

