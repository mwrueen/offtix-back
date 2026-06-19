const Skill = require('../models/Skill');
const ApiError = require('../utils/ApiError');

const findByNameCaseInsensitive = (name) =>
  Skill.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

const getSkills = async () => Skill.find().sort({ name: 1 });

const createSkill = async ({ name, category }) => {
  const existing = await findByNameCaseInsensitive(name);
  if (existing) {
    return { skill: existing, created: false };
  }
  const skill = new Skill({ name, category });
  await skill.save();
  return { skill, created: true };
};

const ensureSkills = async (names) => {
  if (!Array.isArray(names)) {
    throw ApiError.badRequest('names must be an array');
  }
  const skillObjects = await Promise.all(
    names.map(async (name) => {
      let skill = await findByNameCaseInsensitive(name);
      if (!skill) {
        skill = new Skill({ name, category: 'Other' });
        await skill.save();
      }
      return skill;
    })
  );
  return skillObjects;
};

module.exports = { getSkills, createSkill, ensureSkills };
