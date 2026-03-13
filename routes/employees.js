const express = require('express');
const router = express.Router({ mergeParams: true });
const employeeController = require('../controllers/employeeController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// All routes require authentication
router.use(authenticate);

// Get all employees for a company — requires viewEmployeeList permission
router.get('/', requirePermission('viewEmployeeList'), employeeController.getCompanyEmployees);

// Get single employee details — requires viewEmployeeList permission
router.get('/:employeeId', requirePermission('viewEmployeeList'), employeeController.getEmployeeDetails);

// Update employee designation — requires editEmployee permission
router.put('/:employeeId/designation', requirePermission('editEmployee'), employeeController.updateEmployeeDesignation);

// Update employee salary — requires editEmployee permission
router.put('/:employeeId/salary', requirePermission('editEmployee'), employeeController.updateEmployeeSalary);

// Remove employee from company — requires editEmployee permission
router.delete('/:employeeId', requirePermission('editEmployee'), employeeController.removeEmployee);

module.exports = router;

