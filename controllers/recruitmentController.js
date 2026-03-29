const JobCircular = require('../models/JobCircular');
const Application = require('../models/Application');
const Company = require('../models/Company');
const mongoose = require('mongoose');

// @desc    Create a job circular
// @route   POST /api/recruitment/circulars
// @access  Private (manageRecruitment permission required)
exports.createCircular = async (req, res) => {
    try {
        const { title, role, salaryRange, experience, description, jobNature, location, benefits, mandatorySkills, niceToHaveSkills, questions } = req.body;

        const company = await Company.findById(req.user.company);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        // Check if user is owner/founder
        const isOwner = company.owner.toString() === req.user._id.toString();

        if (!isOwner) {
            const member = company.members.find(m => m.user.toString() === req.user._id.toString());
            const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));

            if (!designation?.permissions?.manageRecruitment) {
                return res.status(403).json({ message: 'Permission denied' });
            }
        }

        const jobCircular = new JobCircular({
            company: req.user.company,
            title,
            role,
            salaryRange,
            experience,
            description,
            jobNature: jobNature || 'remote',
            location: location || company.address || '',
            benefits: benefits || '',
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
        if (!circular || (circular.status !== 'active' && !req.user)) {
            return res.status(404).json({ message: 'Job circular not found or not currently active' });
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
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const isOwner = company.owner.toString() === req.user._id.toString();

        if (!isOwner) {
            const member = company.members.find(m => m.user.toString() === req.user._id.toString());
            const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));

            if (!designation?.permissions?.manageRecruitment) {
                return res.status(403).json({ message: 'Permission denied' });
            }
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

        await application.save();
        res.json({ message: 'Candidate hired successfully!', application });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get recruitment stats for the company
// @route   GET /api/recruitment/stats
// @access  Private
exports.getCompanyStats = async (req, res) => {
    try {
        const companyId = req.user.company;
        const company = await Company.findById(companyId);
        if (!company) return res.status(404).json({ message: 'Company not found' });

        const isOwner = company.owner.toString() === req.user._id.toString();

        if (!isOwner) {
            const member = company.members.find(m => m.user.toString() === req.user._id.toString());
            const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));

            if (!designation?.permissions?.manageRecruitment) {
                return res.status(403).json({ message: 'Permission denied' });
            }
        }

        const [totalCirculars, totalApplicants, statusStats] = await Promise.all([
            JobCircular.countDocuments({ company: companyId }),
            Application.countDocuments({ company: companyId }),
            Application.aggregate([
                { $match: { company: companyId } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ])
        ]);

        const stats = {
            totalCirculars,
            totalApplicants,
            shortlisted: statusStats.find(s => s._id === 'shortlisted')?.count || 0,
            interviewed: statusStats.find(s => s._id === 'interviewed')?.count || 0,
            hired: statusStats.find(s => s._id === 'hired')?.count || 0,
        };

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a job circular
// @route   PUT /api/recruitment/circulars/:id
// @access  Private
exports.updateCircular = async (req, res) => {
    try {
        const { title, role, salaryRange, experience, description, jobNature, location, benefits, mandatorySkills, niceToHaveSkills, questions, status } = req.body;
        const circular = await JobCircular.findById(req.params.id);

        if (!circular) return res.status(404).json({ message: 'Circular not found' });
        if (circular.company.toString() !== req.user.company.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const company = await Company.findById(req.user.company);
        const isOwner = company.owner.toString() === req.user._id.toString();

        if (!isOwner) {
            const member = company.members.find(m => m.user.toString() === req.user._id.toString());
            const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));
            if (!designation?.permissions?.manageRecruitment) {
                return res.status(403).json({ message: 'Permission denied' });
            }
        }

        circular.title = title || circular.title;
        circular.role = role || circular.role;
        circular.salaryRange = salaryRange || circular.salaryRange;
        circular.experience = experience !== undefined ? experience : circular.experience;
        circular.description = description || circular.description;
        circular.jobNature = jobNature || circular.jobNature;
        circular.location = location || circular.location;
        circular.benefits = benefits || circular.benefits;
        circular.mandatorySkills = mandatorySkills || circular.mandatorySkills;
        circular.niceToHaveSkills = niceToHaveSkills || circular.niceToHaveSkills;
        circular.questions = questions || circular.questions;
        circular.status = status || circular.status;

        await circular.save();
        res.json(circular);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a job circular
// @route   DELETE /api/recruitment/circulars/:id
// @access  Private
exports.deleteCircular = async (req, res) => {
    try {
        const circular = await JobCircular.findById(req.params.id);
        if (!circular) return res.status(404).json({ message: 'Circular not found' });
        if (circular.company.toString() !== req.user.company.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        const company = await Company.findById(req.user.company);
        const isOwner = company.owner.toString() === req.user._id.toString();
        if (!isOwner) {
            const member = company.members.find(m => m.user.toString() === req.user._id.toString());
            const designation = company.designations.find(d => d.name === (member?.designation || 'Employee'));
            if (!designation?.permissions?.manageRecruitment) {
                return res.status(403).json({ message: 'Permission denied' });
            }
        }

        await JobCircular.findByIdAndDelete(req.params.id);
        res.json({ message: 'Circular deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
