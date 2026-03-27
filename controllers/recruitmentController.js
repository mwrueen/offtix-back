const JobCircular = require('../models/JobCircular');
const Application = require('../models/Application');
const Company = require('../models/Company');
const mongoose = require('mongoose');

// @desc    Create a job circular
// @route   POST /api/recruitment/circulars
// @access  Private (manageRecruitment permission required)
exports.createCircular = async (req, res) => {
    try {
        const { title, role, salaryRange, experience, description, mandatorySkills, niceToHaveSkills, questions } = req.body;

        const company = await Company.findById(req.user.company);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Check permission
        const member = company.members.find(m => m.user.toString() === req.user._id.toString());
        const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));

        if (!designation?.permissions?.manageRecruitment) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        const jobCircular = new JobCircular({
            company: req.user.company,
            title,
            role,
            salaryRange,
            experience,
            description,
            mandatorySkills,
            niceToHaveSkills,
            questions,
            createdBy: req.user._id
        });

        await jobCircular.save();
        res.status(201).json(jobCircular);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all active job circulars publicly
// @route   GET /api/recruitment/public/circulars
// @access  Public
exports.getPublicCirculars = async (req, res) => {
    try {
        const circulars = await JobCircular.find({ status: 'active' })
            .populate('company', 'name logo website')
            .sort({ createdAt: -1 });
        res.json(circulars);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get details of a job circular
// @route   GET /api/recruitment/public/circulars/:id
// @access  Public
exports.getCircularDetails = async (req, res) => {
    try {
        const circular = await JobCircular.findById(req.params.id)
            .populate('company', 'name logo description website industries');
        if (!circular) {
            return res.status(404).json({ message: 'Job circular not found' });
        }
        res.json(circular);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Apply for a job
// @route   POST /api/recruitment/public/apply/:id
// @access  Public
exports.applyForJob = async (req, res) => {
    try {
        const circular = await JobCircular.findById(req.params.id);
        if (!circular || circular.status !== 'active') {
            return res.status(404).json({ message: 'Active job circular not found' });
        }

        const { applicant, answers } = req.body;

        // Basic skill/experience verification as per requirement
        const missingSkills = circular.mandatorySkills.filter(skill =>
            !applicant.skills.map(s => s.toLowerCase()).includes(skill.toLowerCase())
        );

        if (missingSkills.length > 0) {
            return res.status(400).json({
                message: 'You must have all mandatory skills to apply.',
                missing: missingSkills
            });
        }

        if (applicant.experience < circular.experience) {
            return res.status(400).json({
                message: `Min ${circular.experience} years of experience required.`
            });
        }

        const application = new Application({
            jobCircular: circular._id,
            company: circular.company,
            applicant,
            answers
        });

        await application.save();
        res.status(201).json({ message: 'Application submitted successfully!', applicationId: application._id });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get applicants for a circular
// @route   GET /api/recruitment/circulars/:id/applicants
// @access  Private
exports.getApplicants = async (req, res) => {
    try {
        const company = await Company.findById(req.user.company);
        const member = company.members.find(m => m.user.toString() === req.user._id.toString());
        const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));

        if (!designation?.permissions?.manageRecruitment) {
            return res.status(403).json({ message: 'Permission denied' });
        }

        const applicants = await Application.find({ jobCircular: req.params.id });
        res.json(applicants);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update application status (shortlist/reject/etc)
// @route   PATCH /api/recruitment/applications/:id/status
// @access  Private
exports.updateApplicationStatus = async (req, res) => {
    try {
        const { status, notes, interviewDate } = req.body;
        const application = await Application.findById(req.params.id).populate('jobCircular');

        if (!application) return res.status(404).json({ message: 'Application not found' });
        if (application.company.toString() !== req.user.company.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        application.status = status;

        if (status === 'interviewed' && interviewDate) {
            application.interviewHistory.push({
                date: interviewDate,
                notes: notes,
                scheduledBy: req.user._id,
                status: 'scheduled'
            });
        }

        await application.save();
        res.json(application);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Hire candidate
// @route   POST /api/recruitment/applications/:id/hire
// @access  Private
exports.hireCandidate = async (req, res) => {
    try {
        const { salary } = req.body;
        const application = await Application.findById(req.params.id).populate('jobCircular');

        if (!application) return res.status(404).json({ message: 'Application not found' });

        const company = await Company.findById(req.user.company);
        if (application.company.toString() !== company._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // 1. Mark as hired
        application.status = 'hired';
        application.offeredSalary = { amount: salary };
        application.hiredAt = new Date();
        application.hiredBy = req.user._id;

        // 2. We can automatically create a user OR send an invitation
        // For now, let's keep it simple and just update application status.
        // The requirement says "then with setting salary hire him"

        await application.save();
        res.json({ message: 'Candidate hired successfully!', application });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
