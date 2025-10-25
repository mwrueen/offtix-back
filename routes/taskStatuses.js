const express = require('express');
const router = express.Router({ mergeParams: true });
const taskStatusController = require('../controllers/taskStatusController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', taskStatusController.getTaskStatuses);
router.post('/', taskStatusController.createTaskStatus);
router.put('/:statusId', taskStatusController.updateTaskStatus);
router.delete('/:statusId', taskStatusController.deleteTaskStatus);

module.exports = router;