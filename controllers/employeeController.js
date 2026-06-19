const asyncHandler = require('../utils/asyncHandler');
const employeeService = require('../services/employeeService');

exports.getCompanyEmployees = asyncHandler(async (req, res) => {
  const result = await employeeService.getCompanyEmployees(req.params.companyId, req.user._id);
  res.json(result);
});

exports.getEmployeeDetails = asyncHandler(async (req, res) => {
  const result = await employeeService.getEmployeeDetails(req.params.companyId, req.params.employeeId, req.user._id);
  res.json(result);
});

exports.updateEmployeeDesignation = asyncHandler(async (req, res) => {
  const result = await employeeService.updateEmployeeDesignation(
    req.params.companyId,
    req.params.employeeId,
    req.body.designation,
    req.user._id
  );
  res.json(result);
});

exports.updateEmployeeSalary = asyncHandler(async (req, res) => {
  const result = await employeeService.updateEmployeeSalary(
    req.params.companyId,
    req.params.employeeId,
    req.body,
    req.user._id
  );
  res.json(result);
});

exports.removeEmployee = asyncHandler(async (req, res) => {
  const result = await employeeService.removeEmployee(req.params.companyId, req.params.employeeId, req.user._id);
  res.json(result);
});

