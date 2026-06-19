const asyncHandler = require('../utils/asyncHandler');
const skillService = require('../services/skillService');

// @desc    Get all skills
// @route   GET /api/skills
// @access  Private
exports.getSkills = asyncHandler(async (req, res) => {
    const skills = await skillService.getSkills();
    res.json(skills);
});

// @desc    Create a new skill
// @route   POST /api/skills
// @access  Private
exports.createSkill = asyncHandler(async (req, res) => {
    const { name, category } = req.body;
    const result = await skillService.createSkill({ name, category });
    if (!result.created) {
        return res.status(400).json({ message: 'Skill already exists', skill: result.skill });
    }
    res.status(201).json(result.skill);
});

// @desc    Bulk create/get skills
// @route   POST /api/skills/bulk
// @access  Private
exports.ensureSkills = asyncHandler(async (req, res) => {
    const skills = await skillService.ensureSkills(req.body.names);
    res.json(skills);
});
