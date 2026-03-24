const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateTask } = require('../middleware/validation');
const uploadHandoff = require('../middleware/uploadHandoff');

router.use(authenticate);

router.get('/', taskController.getTasks);
router.post('/', requirePermission('createTask'), validateTask, taskController.createTask);
router.post('/reorder', requirePermission('editTask'), taskController.reorderTasks);
router.post('/bulk-schedule', requirePermission('editTask'), taskController.bulkScheduleTasks);
router.post('/bulk-assign-member', requirePermission('editTask'), taskController.bulkAssignMemberToAllTasks);
router.post('/bulk-update-role-durations', requirePermission('editTask'), taskController.bulkUpdateRoleDurations);
router.put('/:taskId', requirePermission('editTask'), validateTask, taskController.updateTask);
router.delete('/:taskId', requirePermission('deleteTask'), taskController.deleteTask);

// Task workflow role routes
router.get('/:taskId/workflow', taskController.getTaskWithWorkflow);
router.post('/:taskId/workflow/start', taskController.startTaskWorkflow);
router.post('/:taskId/workflow/complete-role', uploadHandoff.array('files', 10), taskController.completeRoleAndHandoff);
router.post('/:taskId/workflow/skip-role', taskController.skipCurrentRole);
router.put('/:taskId/role-assignments', taskController.updateRoleAssignments);

module.exports = router;