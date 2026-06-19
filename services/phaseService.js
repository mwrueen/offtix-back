const Phase = require('../models/Phase');
const { assertProjectAccess } = require('../utils/projectAccess');

const DEFAULT_PHASES = [
  { name: 'Planning', order: 0 },
  { name: 'Development', order: 1 },
  { name: 'Testing', order: 2 },
  { name: 'Deployment', order: 3 }
];

const getPhases = async (projectId, userId) => {
  await assertProjectAccess(projectId, userId);
  let phases = await Phase.find({ project: projectId }).sort({ order: 1 });
  if (phases.length === 0) {
    phases = await Phase.insertMany(DEFAULT_PHASES.map((p) => ({ ...p, project: projectId })));
  }
  return phases;
};

const createPhase = async (projectId, userId, data) => {
  await assertProjectAccess(projectId, userId);
  const phase = new Phase({ ...data, project: projectId });
  await phase.save();
  return phase;
};

module.exports = { getPhases, createPhase };
