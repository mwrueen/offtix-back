const asyncHandler = require('../utils/asyncHandler');
const taskRoleService = require('../services/taskRoleService');

exports.getProjectRoles = asyncHandler(async (req, res) => {
  const roles = await taskRoleService.getProjectRoles(req.params.projectId, req.user._id);
  res.json(roles);
});

exports.createRole = asyncHandler(async (req, res) => {
  const role = await taskRoleService.createRole(req.params.projectId, req.user._id, req.body);
  res.status(201).json(role);
});

exports.updateRole = asyncHandler(async (req, res) => {
  const role = await taskRoleService.updateRole(
    req.params.projectId,
    req.params.roleId,
    req.user._id,
    req.body
  );
  res.json(role);
});

exports.deleteRole = asyncHandler(async (req, res) => {
  const result = await taskRoleService.deleteRole(
    req.params.projectId,
    req.params.roleId,
    req.user._id
  );
  res.json(result);
});

exports.reorderRoles = asyncHandler(async (req, res) => {
  const roles = await taskRoleService.reorderRoles(
    req.params.projectId,
    req.user._id,
    req.body.roleOrders
  );
  res.json(roles);
});

exports.initializeDefaultRoles = asyncHandler(async (req, res) => {
  const roles = await taskRoleService.initializeDefaultRoles(req.params.projectId, req.user._id);
  res.status(201).json(roles);
});

