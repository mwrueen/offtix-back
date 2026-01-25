const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { validateTask } = require('../middleware/validation');
const uploadHandoff = require('../middleware/uploadHandoff');

router.use(authenticate);

router.get('/', taskController.getTasks);
router.post('/', validateTask, taskController.createTask);
router.post('/reorder', taskController.reorderTasks);
router.put('/:id', validateTask, taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Task workflow role routes
router.get('/:taskId/workflow', taskController.getTaskWithWorkflow);
router.post('/:taskId/workflow/start', taskController.startTaskWorkflow);
router.post('/:taskId/workflow/complete-role', uploadHandoff.array('files', 10), taskController.completeRoleAndHandoff);
router.post('/:taskId/workflow/skip-role', taskController.skipCurrentRole);
router.put('/:taskId/role-assignments', taskController.updateRoleAssignments);

module.exports = router;