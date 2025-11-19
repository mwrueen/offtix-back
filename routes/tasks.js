const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validateTask } = require('../middleware/validation');

router.use(authenticate);

router.get('/', taskController.getTasks);
router.post('/', validateTask, taskController.createTask);
router.post('/reorder', taskController.reorderTasks);
router.put('/:id', validateTask, taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.get('/:taskId/status-check/:statusId', taskController.checkStatusChange);

module.exports = router;