const TaskRole = require('../models/TaskRole');
const { assertProjectAccess } = require('../utils/projectAccess');
const ApiError = require('../utils/ApiError');

const populateRole = async (role) => {
  await role.populate('defaultAssignees', 'name email avatar');
  await role.populate('createdBy', 'name email');
  return role;
};

const getProjectRoles = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  return TaskRole.find({ project: projectId, isActive: true })
    .populate('defaultAssignees', 'name email avatar')
    .populate('createdBy', 'name email')
    .sort({ order: 1 });
};

const createRole = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const lastRole = await TaskRole.findOne({ project: projectId }).sort({ order: -1 });
  const order = lastRole ? lastRole.order + 1 : 1;
  const role = new TaskRole({
    ...data,
    order,
    project: projectId,
    createdBy: userId
  });
  await role.save();
  return populateRole(role);
};

const updateRole = async (projectId, roleId, userId, data) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const role = await TaskRole.findOne({ _id: roleId, project: projectId });
  if (!role) throw ApiError.notFound('Role not found');
  Object.assign(role, data);
  await role.save();
  return populateRole(role);
};

const deleteRole = async (projectId, roleId, userId) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const role = await TaskRole.findOne({ _id: roleId, project: projectId });
  if (!role) throw ApiError.notFound('Role not found');
  role.isActive = false;
  await role.save();
  return { message: 'Role deleted successfully' };
};

const reorderRoles = async (projectId, userId, roleOrders) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  await Promise.all(
    roleOrders.map(({ roleId, order }) => TaskRole.findByIdAndUpdate(roleId, { order }, { new: true }))
  );
  return TaskRole.find({ project: projectId, isActive: true })
    .populate('defaultAssignees', 'name email avatar')
    .sort({ order: 1 });
};

const initializeDefaultRoles = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const existingCount = await TaskRole.countDocuments({ project: projectId, isActive: true });
  if (existingCount > 0) {
    throw ApiError.badRequest('Workflow roles already exist for this project');
  }
  const defaultRoles = TaskRole.getDefaultRoles();
  return Promise.all(
    defaultRoles.map((roleData) =>
      TaskRole.create({ ...roleData, project: projectId, createdBy: userId })
    )
  );
};

module.exports = {
  getProjectRoles,
  createRole,
  updateRole,
  deleteRole,
  reorderRoles,
  initializeDefaultRoles
};
