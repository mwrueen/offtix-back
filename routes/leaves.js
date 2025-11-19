const express = require('express');
const router = express.Router({ mergeParams: true });
const leaveController = require('../controllers/leaveController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all leaves for company
router.get('/', leaveController.getCompanyLeaves);

// Get leave statistics
router.get('/statistics', leaveController.getLeaveStatistics);

// Get leave balance for an employee
router.get('/balance/:employeeId', leaveController.getLeaveBalance);

// Request new leave
router.post('/', leaveController.requestLeave);

// Get leave details
router.get('/:leaveId', leaveController.getLeaveDetails);

// Update leave request (only by employee, only if pending)
router.put('/:leaveId', leaveController.updateLeaveRequest);

// Approve/Reject leave
router.patch('/:leaveId/status', leaveController.updateLeaveStatus);

// Cancel leave
router.patch('/:leaveId/cancel', leaveController.cancelLeave);

module.exports = router;

