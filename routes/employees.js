const express = require('express');
const router = express.Router({ mergeParams: true });
const employeeController = require('../controllers/employeeController');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Get all employees for a company
router.get('/', employeeController.getCompanyEmployees);

// Get single employee details
router.get('/:employeeId', employeeController.getEmployeeDetails);

// Update employee designation
router.put('/:employeeId/designation', employeeController.updateEmployeeDesignation);

// Update employee salary
router.put('/:employeeId/salary', employeeController.updateEmployeeSalary);

// Remove employee from company
router.delete('/:employeeId', employeeController.removeEmployee);

module.exports = router;

