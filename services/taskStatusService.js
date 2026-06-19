const TaskStatus = require('../models/TaskStatus');
const Task = require('../models/Task');
const { assertProjectAccess } = require('../utils/projectAccess');
const ApiError = require('../utils/ApiError');

const DEFAULT_STATUSES = [
  { name: 'To Do', color: '#fbbf24', order: 0 },
  { name: 'In Progress', color: '#3b82f6', order: 1 },
  { name: 'Review', color: '#8b5cf6', order: 2 },
  { name: 'Completed', color: '#10b981', order: 3 }
];

const getTaskStatuses = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  let statuses = await TaskStatus.find({ project: projectId }).sort({ order: 1 });
  if (statuses.length === 0) {
    const inserts = DEFAULT_STATUSES.map((s) => ({ ...s, project: projectId }));
    statuses = await TaskStatus.insertMany(inserts);
  }
  return statuses;
};

const createTaskStatus = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const maxOrder = await TaskStatus.findOne({ project: projectId }).sort({ order: -1 });
  const order = maxOrder ? maxOrder.order + 1 : 0;
  const status = new TaskStatus({ ...data, project: projectId, order });
  await status.save();
  return status;
};

const updateTaskStatus = async (projectId, statusId, userId, data) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const status = await TaskStatus.findOneAndUpdate(
    { _id: statusId, project: projectId },
    data,
    { new: true }
  );
  if (!status) throw ApiError.notFound('Task status not found');
  return status;
};

const deleteTaskStatus = async (projectId, statusId, userId) => {
  await assertProjectAccess(projectId, userId, { requireOwner: true });
  const tasksUsingStatus = await Task.countDocuments({ status: statusId });
  if (tasksUsingStatus > 0) {
    const error = ApiError.badRequest('Cannot delete status that is being used by tasks');
    error.body = { tasksCount: tasksUsingStatus };
    throw error;
  }
  const status = await TaskStatus.findOneAndDelete({ _id: statusId, project: projectId });
  if (!status) throw ApiError.notFound('Task status not found');
  return { message: 'Task status deleted successfully' };
};

module.exports = { getTaskStatuses, createTaskStatus, updateTaskStatus, deleteTaskStatus };
