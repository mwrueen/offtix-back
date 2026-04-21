const express = require('express');
const router = express.Router({ mergeParams: true });
const taskController = require('../controllers/taskController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { validateTask } = require('../middleware/validation');
const uploadHandoff = require('../middleware/uploadHandoff');

router.use(authenticate);

router.get('/', taskController.getTasks);
router.get('/bulk-durations', taskController.getBulkUserDurations);
router.get('/:taskId', taskController.getTaskById);
const checkCreateTaskPermission = async (req, res, next) => {
    if (req.body.parent) {
        try {
            const Task = require('../models/Task');
            const parentTask = await Task.findById(req.body.parent);
            if (parentTask) {
                const userId = req.user._id.toString();
                const isAssigned = 
                    (parentTask.assignees && parentTask.assignees.some(a => a && a.toString() === userId)) ||
                    (parentTask.roleAssignments && parentTask.roleAssignments.some(ra => ra.assignees && ra.assignees.some(a => a && a.toString() === userId))) ||
                    (parentTask.sequentialAssignees && parentTask.sequentialAssignees.some(sa => sa && sa.user && sa.user.toString() === userId));
                
                if (isAssigned) {
                    return next();
                } else {
                    return res.status(403).json({ error: 'You are not assigned to the parent task, cannot create subtask via this route.' });
                }
            } else {
                return res.status(404).json({ error: 'Parent task not found for permission check.' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Internal error checking parent task permission: ' + e.message });
        }
    }
    return requirePermission('createTask')(req, res, next);
};

router.post('/', checkCreateTaskPermission, validateTask, taskController.createTask);
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

// Duration per member per role
// - Member sets their own duration (must be assigned to that role)
// - Owner / permitted member sets any user's duration on any role
router.put('/:taskId/role-duration', taskController.setRoleDuration);
router.get('/:taskId/durations', taskController.getTaskDurations);

module.exports = router;