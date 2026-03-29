const Skill = require('../models/Skill');

// @desc    Get all skills
// @route   GET /api/skills
// @access  Private
exports.getSkills = async (req, res) => {
    try {
        const skills = await Skill.find().sort({ name: 1 });
        res.json(skills);
    } catch (error) {
        console.error('Error in getSkills:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a new skill
// @route   POST /api/skills
// @access  Private
exports.createSkill = async (req, res) => {
    try {
        const { name, category } = req.body;

        // Check if skill already exists (case-insensitive)
        let skill = await Skill.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });

        if (skill) {
            return res.status(400).json({ message: 'Skill already exists', skill });
        }

        skill = new Skill({ name, category });
        await skill.save();
        res.status(201).json(skill);
    } catch (error) {
        console.error('Error in createSkill:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk create/get skills
// @route   POST /api/skills/bulk
// @access  Private
exports.ensureSkills = async (req, res) => {
    try {
        const { names } = req.body; // Array of strings
        if (!Array.isArray(names)) {
            return res.status(400).json({ message: 'names must be an array' });
        }

        const skillObjects = await Promise.all(names.map(async (name) => {
            let skill = await Skill.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
            if (!skill) {
                skill = new Skill({ name, category: 'Other' });
                await skill.save();
            }
            return skill;
        }));

        res.json(skillObjects);
    } catch (error) {
        console.error('Error in ensureSkills:', error);
        res.status(500).json({ message: error.message });
    }
};
