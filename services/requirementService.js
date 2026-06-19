const Requirement = require('../models/Requirement');
const TaskStatus = require('../models/TaskStatus');
const Task = require('../models/Task');
const fs = require('fs');
const path = require('path');
const { assertProjectAccess } = require('../utils/projectAccess');
const ApiError = require('../utils/ApiError');

const populateRequirement = async (requirement) => {
  await requirement.populate('createdBy', 'name email');
  await requirement.populate('assignedTo', 'name email');
  await requirement.populate('comments.author', 'name email');
  await requirement.populate('convertedToTask', 'title');
  return requirement;
};

const getRequirements = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  return Requirement.find({ project: projectId })
    .populate('createdBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('comments.author', 'name email')
    .populate('convertedToTask', 'title')
    .sort({ createdAt: -1 });
};

const createRequirement = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const requirement = new Requirement({ ...data, project: projectId, createdBy: userId });
  await requirement.save();
  await populateRequirement(requirement);
  return requirement;
};

const updateRequirement = async (projectId, requirementId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  Object.assign(requirement, data);
  await requirement.save();
  await populateRequirement(requirement);
  return requirement;
};

const deleteRequirement = async (projectId, requirementId, userId) => {
  await assertProjectAccess(projectId, userId);
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  if (requirement.convertedToTask) {
    throw ApiError.badRequest('Cannot delete a requirement that has been converted to a task');
  }
  await Requirement.findByIdAndDelete(requirementId);
  return { message: 'Requirement deleted successfully' };
};

const convertToTask = async (projectId, requirementId, userId) => {
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  if (requirement.convertedToTask) throw ApiError.badRequest('Requirement already converted to a task');
  await assertProjectAccess(projectId, userId);

  const priorityMap = { low: 'low', medium: 'medium', high: 'high', critical: 'urgent' };
  let status = await TaskStatus.findOne({ project: projectId }).sort({ order: 1 });
  const task = new Task({
    title: requirement.title,
    description: requirement.description,
    project: projectId,
    requirement: requirementId,
    status: status ? status._id : undefined,
    createdBy: userId,
    priority: priorityMap[requirement.priority] || 'medium',
    assignees: requirement.assignedTo ? [requirement.assignedTo] : []
  });
  await task.save();
  requirement.convertedToTask = task._id;
  await requirement.save();
  return { task, requirement };
};

const addComment = async (projectId, requirementId, userId, content) => {
  await assertProjectAccess(projectId, userId);
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  requirement.comments.push({ content, author: userId });
  await requirement.save();
  await requirement.populate('comments.author', 'name email');
  return requirement;
};

const uploadAttachment = async (projectId, requirementId, userId, file) => {
  await assertProjectAccess(projectId, userId);
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  if (!file) throw ApiError.badRequest('No file uploaded');
  const attachment = {
    filename: file.filename,
    originalName: file.originalname,
    path: `/uploads/requirement-files/${file.filename}`,
    size: file.size,
    uploadedBy: userId,
    uploadedAt: new Date()
  };
  requirement.attachments.push(attachment);
  await requirement.save();
  await populateRequirement(requirement);
  return { message: 'File uploaded successfully', requirement };
};

const deleteAttachment = async (projectId, requirementId, attachmentId, userId) => {
  await assertProjectAccess(projectId, userId);
  const requirement = await Requirement.findOne({ _id: requirementId, project: projectId });
  if (!requirement) throw ApiError.notFound('Requirement not found');
  const attachmentIndex = requirement.attachments.findIndex((a) => a._id.toString() === attachmentId);
  if (attachmentIndex === -1) throw ApiError.notFound('Attachment not found');
  const attachment = requirement.attachments[attachmentIndex];
  const filePath = path.join(__dirname, '..', attachment.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  requirement.attachments.splice(attachmentIndex, 1);
  await requirement.save();
  await populateRequirement(requirement);
  return { message: 'Attachment deleted successfully', requirement };
};

module.exports = {
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  convertToTask,
  addComment,
  uploadAttachment,
  deleteAttachment
};
