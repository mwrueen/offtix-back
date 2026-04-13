const JobCircular = require('../models/JobCircular');
const Application = require('../models/Application');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const User = require('../models/User');
const mongoose = require('mongoose');
const emitSocketNotification = require('../utils/emitSocketNotification');
const sendEmail = require('../utils/sendEmail');

function applicantMatchesUser(application, reqUser) {
    if (!application || !reqUser) return false;
    const rawUser = application.user;
    const uid = rawUser != null
        ? (rawUser._id ? rawUser._id.toString() : rawUser.toString())
        : null;
    if (uid && uid === reqUser._id.toString()) return true;
    const appEmail = String(application.applicant?.email || '').toLowerCase().trim();
    const userEmail = String(reqUser.email || '').toLowerCase().trim();
    return Boolean(appEmail && userEmail && appEmail === userEmail);
}

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
        const payload = circular.toObject ? circular.toObject() : { ...circular };
        if (req.user) {
            const emailNorm = (req.user.email || '').toLowerCase().trim();
            const or = [{ user: req.user._id }];
            if (emailNorm) {
                or.push({ 'applicant.email': emailNorm });
            }
            const existing = await Application.findOne({
                jobCircular: circular._id,
                $or: or
            }).select('_id');
            payload.alreadyApplied = !!existing;
        } else {
            payload.alreadyApplied = false;
        }
        res.json(payload);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Apply for a job
// @route   POST /api/recruitment/public/apply/:id
// @access  Private (authenticated users only; enforced by route middleware)
exports.applyForJob = async (req, res) => {
    try {
        const circular = await JobCircular.findById(req.params.id);
        if (!circular || circular.status !== 'active') {
            return res.status(404).json({ message: 'Active job circular not found' });
        }

        const { applicant, answers } = req.body;
        if (!applicant?.email || !applicant?.name) {
            return res.status(400).json({ message: 'Applicant name and email are required' });
        }

        const emailNorm = String(applicant.email).toLowerCase().trim();
        const linkedUserId = req.user?._id || null;

        const duplicateOr = [{ 'applicant.email': emailNorm }];
        if (linkedUserId) {
            duplicateOr.push({ user: linkedUserId });
        }

        const existing = await Application.findOne({
            jobCircular: circular._id,
            $or: duplicateOr
        }).select('_id');
        if (existing) {
            return res.status(409).json({ message: 'You have already applied for this position.' });
        }

        const application = new Application({
            jobCircular: circular._id,
            company: circular.company,
            user: linkedUserId || undefined,
            applicant: { ...applicant, email: emailNorm },
            answers
        });

        await application.save();

        // Notify company founder/owner
        const company = await Company.findById(circular.company);
        if (company && company.owner) {
            const ownerNotif = await Notification.create({
                user: company.owner,
                company: company._id,
                type: 'job_application',
                title: 'New Job Application',
                message: `${applicant.name} has applied for the "${circular.title}" position.`,
                relatedId: application._id,
                relatedModel: 'Application'
            });
            emitSocketNotification(req, company.owner, ownerNotif);
        }

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

        const apps = await Application.find({ jobCircular: req.params.id }).lean();

        const emailsNeedingUser = [
            ...new Set(
                apps
                    .filter((a) => !a.user && a.applicant?.email)
                    .map((a) => String(a.applicant.email).toLowerCase().trim())
            )
        ];

        let emailToUserId = new Map();
        if (emailsNeedingUser.length) {
            const matched = await User.find({ email: { $in: emailsNeedingUser } })
                .select('_id email')
                .lean();
            emailToUserId = new Map(matched.map((u) => [u.email, u._id]));
        }

        const backfillIds = [];
        const payload = apps.map((app) => {
            if (app.user) return app;
            const em =
                app.applicant?.email && String(app.applicant.email).toLowerCase().trim();
            const resolved = em && emailToUserId.get(em);
            if (resolved) {
                backfillIds.push({ _id: app._id, user: resolved });
                return { ...app, user: resolved };
            }
            return app;
        });

        if (backfillIds.length) {
            await Promise.all(
                backfillIds.map(({ _id, user }) =>
                    Application.updateOne({ _id }, { $set: { user } }).exec()
                )
            );
        }

        res.json(payload);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single application by ID
// @route   GET /api/recruitment/applications/:id
// @access  Private
exports.getApplicationById = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id).populate('jobCircular');
        if (!application) return res.status(404).json({ message: 'Application not found' });
        
        // Ensure user has permission
        if (application.company.toString() !== req.user.company.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // Hydrate linked user if any
        if (!application.user && application.applicant?.email) {
            const u = await User.findOne({ email: application.applicant.email.toLowerCase().trim() }).select('_id');
            if (u) {
                application.user = u._id;
                await application.save();
            }
        }
        res.json(application);
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

        const wasHired = application.status === 'hired';
        const offerAccepted = application.offerLetterStatus === 'accepted';

        if (wasHired && status !== 'hired') {
            if (offerAccepted && application.user) {
                const company = await Company.findById(application.company);
                const uid = application.user.toString();
                if (company && company.owner.toString() !== uid) {
                    company.members = company.members.filter(
                        (m) => m.user.toString() !== uid
                    );
                    await company.save();
                }
                const stillMember = await Company.findOne({
                    $or: [{ owner: application.user }, { 'members.user': application.user }]
                }).select('_id');
                await User.findByIdAndUpdate(application.user, {
                    company: stillMember ? stillMember._id : null
                });
            }
            application.hiredAt = undefined;
            application.hiredBy = undefined;
            application.offerLetterStatus = 'none';
            application.offerAcceptedAt = undefined;
            application.offeredSalary = undefined;
            application.hireRoleDescription = undefined;
        }

        application.status = status;

        if (status === 'interviewed' && interviewDate) {
            application.interviewHistory.push({
                date: interviewDate,
                notes: notes,
                scheduledBy: req.user._id,
                status: 'scheduled'
            });

            try {
                // Send Notification and Email
                const applicantEmail = application.applicant?.email;
                const applicantName = application.applicant?.name || 'Applicant';
                const companyInfo = application.company ? await Company.findById(application.company).select('name') : null;
                const companyName = companyInfo?.name || 'A company';
                const jobTitle = application.jobCircular?.title || 'the position';
                
                // Formatted date
                const dateObj = new Date(interviewDate);
                const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
                }) : String(interviewDate);
                
                // Resolve user id from email if missing
                let notifyUserId = application.user;
                if (!notifyUserId && applicantEmail) {
                    const u = await User.findOne({ email: applicantEmail }).select('_id').lean();
                    notifyUserId = u?._id;
                }

                // Notification if user is registered
                if (notifyUserId) {
                    const notif = await Notification.create({
                        user: notifyUserId,
                        company: application.company,
                        type: 'job_application',
                        title: 'Interview Scheduled',
                        message: `Your interview for ${jobTitle} at ${companyName} is scheduled for ${formattedDate}.`,
                        relatedId: application._id,
                        relatedModel: 'Application'
                    });
                    emitSocketNotification(req, notifyUserId, notif);
                }

                // Send Email
                if (applicantEmail) {
                    await sendEmail({
                        email: applicantEmail,
                        subject: `Interview Invitation: ${jobTitle} @ ${companyName}`,
                        message: `Hi ${applicantName},\n\nYou have been invited to an interview for ${jobTitle} at ${companyName}.\n\nDate & Time: ${formattedDate}\nDetails/Link: ${notes || 'N/A'}\n\nPlease be prepared.\n\nBest,\n${companyName}`,
                        html: `<div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #4f46e5;">Interview Invitation</h2>
                            <p>Hi <strong>${applicantName}</strong>,</p>
                            <p>You have been invited to an interview for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p>
                            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                                <p style="margin: 0 0 10px 0;"><strong>Date & Time:</strong><br/>${formattedDate}</p>
                                <p style="margin: 0;"><strong>Additional Details / Meeting Link:</strong><br/>${notes ? notes.replace(/\n/g, '<br/>') : 'Please wait for further details or contact the employer.'}</p>
                            </div>
                            <p>Looking forward to speaking with you!</p>
                            <p style="color: #64748b; font-size: 14px; margin-top: 30px;">Best regards,<br/>The ${companyName} Hiring Team</p>
                        </div>`
                    });
                }
            } catch (err) {
                console.error("Error sending interview notification:", err);
            }
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
        const { salary, roleDescription, facilities, policies } = req.body;
        const application = await Application.findById(req.params.id).populate('jobCircular');

        if (!application) return res.status(404).json({ message: 'Application not found' });

        const company = await Company.findById(req.user.company);
        if (application.company.toString() !== company._id.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        // 1. Mark as hired; candidate must accept offer letter before joining as employee
        application.status = 'hired';
        application.offeredSalary = { amount: salary, currency: company.currency || 'USD' };
        application.hiredAt = new Date();
        application.hiredBy = req.user._id;
        application.offerLetterStatus = 'pending';
        if (roleDescription != null && typeof roleDescription === 'string') {
            application.hireRoleDescription = roleDescription.slice(0, 100000);
        }
        if (facilities != null && typeof facilities === 'string') {
            application.hireFacilities = facilities.slice(0, 100000);
        }
        if (policies != null && typeof policies === 'string') {
            application.hirePolicies = policies.slice(0, 100000);
        }

        await application.save();

        let notifyUserId = application.user;
        if (!notifyUserId) {
            const u = await User.findOne({ email: application.applicant.email }).select('_id').lean();
            notifyUserId = u?._id;
        }
        const hiringCompany = await Company.findById(application.company).select('name');
        if (notifyUserId) {
            const offerNotif = await Notification.create({
                user: notifyUserId,
                company: application.company,
                type: 'job_offer',
                title: 'Job offer letter',
                message: `${hiringCompany?.name || 'A company'} sent you an offer. Review and accept it to join as an employee.`,
                relatedId: application._id,
                relatedModel: 'Application'
            });
            emitSocketNotification(req, notifyUserId, offerNotif);
        }

        res.json({ message: 'Candidate hired successfully!', application });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Candidate: offer letter details
// @route   GET /api/recruitment/applications/:id/offer-details
// @access  Private
exports.getOfferLetterDetails = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id)
            .populate('company', 'name logo currency')
            .populate('jobCircular', 'title role');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        if (application.status !== 'hired') {
            return res.status(400).json({ message: 'There is no offer associated with this application.' });
        }
        if (!applicantMatchesUser(application, req.user)) {
            return res.status(403).json({ message: 'You are not authorized to view this offer.' });
        }

        if (application.offerLetterStatus === 'accepted') {
            return res.json({
                phase: 'accepted',
                companyId: application.company._id,
                companyName: application.company.name
            });
        }
        if (application.offerLetterStatus === 'pending') {
            return res.json({
                phase: 'pending',
                applicationId: application._id,
                company: application.company,
                jobTitle: application.jobCircular?.title,
                role: application.jobCircular?.role,
                offeredSalary: application.offeredSalary,
                hireRoleDescription: application.hireRoleDescription || '',
                applicantName: application.applicant?.name
            });
        }
        if (!application.offerLetterStatus || application.offerLetterStatus === 'none') {
            return res.status(400).json({
                message: 'This hire does not include an online offer letter. Contact the employer if you need access.'
            });
        }
        if (application.offerLetterStatus === 'declined') {
            return res.status(400).json({ message: 'This offer was declined.' });
        }
        return res.status(400).json({ message: 'This offer is no longer available.' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Candidate: accept offer and join company as employee
// @route   POST /api/recruitment/applications/:id/accept-offer
// @access  Private
exports.acceptOfferLetter = async (req, res) => {
    try {
        const application = await Application.findById(req.params.id).populate('jobCircular');

        if (!application) {
            return res.status(404).json({ message: 'Application not found' });
        }
        if (application.status !== 'hired') {
            return res.status(400).json({ message: 'Invalid application state.' });
        }
        if (application.offerLetterStatus !== 'pending') {
            if (application.offerLetterStatus === 'accepted') {
                return res.status(400).json({ message: 'You have already accepted this offer.' });
            }
            if (!application.offerLetterStatus || application.offerLetterStatus === 'none') {
                return res.status(400).json({
                    message: 'This hire does not use online offer acceptance. Contact the employer if you need access.'
                });
            }
            return res.status(400).json({ message: 'This offer is no longer available.' });
        }
        if (!applicantMatchesUser(application, req.user)) {
            return res.status(403).json({ message: 'You are not authorized to accept this offer.' });
        }

        const userId = req.user._id;
        if (application.user && application.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Sign in as the applicant account linked to this application.' });
        }
        if (!application.user) {
            application.user = userId;
        }

        const company = await Company.findById(application.company);
        if (!company) {
            return res.status(404).json({ message: 'Company not found' });
        }

        const ownerId = company.owner.toString();
        const alreadyMember =
            ownerId === userId.toString() ||
            company.members.some((m) => m.user.toString() === userId.toString());

        if (!alreadyMember) {
            const salary = Number(application.offeredSalary?.amount) || 0;
            let designation = (application.jobCircular && application.jobCircular.role) || 'Employee';
            const designationNames = new Set((company.designations || []).map((d) => d.name));
            if (!designationNames.has(designation)) {
                designation = 'Employee';
            }
            const newMember = {
                user: userId,
                designation,
                currentSalary: salary,
                joinedAt: new Date()
            };
            if (salary > 0) {
                newMember.salaryHistory = [{
                    amount: salary,
                    effectiveDate: new Date(),
                    reason: 'Starting salary (accepted job offer)',
                    updatedBy: userId
                }];
            }
            company.members.push(newMember);
            await company.save();
        }

        await User.findByIdAndUpdate(userId, { company: company._id });

        application.offerLetterStatus = 'accepted';
        application.offerAcceptedAt = new Date();
        await application.save();

        res.json({
            message: 'Welcome aboard! You are now part of the team.',
            companyId: company._id
        });
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
