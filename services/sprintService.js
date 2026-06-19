const Sprint = require('../models/Sprint');
const { assertProjectAccess } = require('../utils/projectAccess');

const buildDefaultSprints = (projectId) => {
  const now = new Date();
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;
  return [
    {
      name: 'Sprint 1',
      sprintNumber: 1,
      startDate: now,
      endDate: new Date(now.getTime() + twoWeeks),
      project: projectId
    },
    {
      name: 'Sprint 2',
      sprintNumber: 2,
      startDate: new Date(now.getTime() + twoWeeks),
      endDate: new Date(now.getTime() + 2 * twoWeeks),
      project: projectId
    }
  ];
};

const getSprints = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  let sprints = await Sprint.find({ project: projectId }).sort({ sprintNumber: 1 });
  if (sprints.length === 0) {
    sprints = await Sprint.insertMany(buildDefaultSprints(projectId));
  }
  return sprints;
};

const createSprint = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const sprint = new Sprint({ ...data, project: projectId });
  await sprint.save();
  return sprint;
};

module.exports = { getSprints, createSprint };
