const JobCircular = require('../models/JobCircular');
const Application = require('../models/Application');
const Company = require('../models/Company');
const Notification = require('../models/Notification');
const User = require('../models/User');
const emitSocketNotification = require('../utils/emitSocketNotification');
const sendEmail = require('../utils/sendEmail');
const ApiError = require('../utils/ApiError');

const MAX_TEXT_LENGTH = 100000;

const applicantMatchesUser = (application, reqUser) => {
  if (!application || !reqUser) return false;
  const rawUser = application.user;
  const uid = rawUser != null ? (rawUser._id ? rawUser._id.toString() : rawUser.toString()) : null;
  if (uid && uid === reqUser._id.toString()) return true;
  const appEmail = String(application.applicant?.email || '').toLowerCase().trim();
  const userEmail = String(reqUser.email || '').toLowerCase().trim();
  return Boolean(appEmail && userEmail && appEmail === userEmail);
};

const requireRecruitmentPermission = async (companyId, userId) => {
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');
  const isOwner = company.owner.toString() === userId.toString();
  if (!isOwner) {
    const member = company.members.find((m) => m.user.toString() === userId.toString());
    const designation = company.designations.find((d) => d.name === (member?.designation || 'Employee'));
    if (!designation?.permissions?.manageRecruitment) {
      throw ApiError.forbidden('Permission denied');
    }
  }
  return company;
};

const createCircular = async (user, body) => {
  const company = await requireRecruitmentPermission(user.company, user._id);
  const {
    title, role, salaryRange, experience, description, jobNature, location,
    benefits, mandatorySkills, niceToHaveSkills, questions, deadline
  } = body;
  const jobCircular = new JobCircular({
    company: user.company,
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
    deadline: deadline || undefined,
    createdBy: user._id
  });
  await jobCircular.save();
  return jobCircular;
};

const getPublicCirculars = async () => {
  const hiredApplications = await Application.find({ status: 'hired' }).distinct('jobCircular');
  const now = new Date();
  return JobCircular.find({
    status: 'active',
    _id: { $nin: hiredApplications },
    $or: [{ deadline: { $gte: now } }, { deadline: null }, { deadline: { $exists: false } }]
  })
    .populate('company', 'name logo website')
    .sort({ createdAt: -1 });
};

const getCircularDetails = async (id, user) => {
  const circular = await JobCircular.findById(id)
    .populate('company', 'name logo description website industries address email phone');
  if (!circular || (circular.status !== 'active' && !user)) {
    throw ApiError.notFound('Job circular not found or not currently active');
  }
  const payload = circular.toObject ? circular.toObject() : { ...circular };
  if (user) {
    const emailNorm = (user.email || '').toLowerCase().trim();
    const or = [{ user: user._id }];
    if (emailNorm) or.push({ 'applicant.email': emailNorm });
    const existing = await Application.findOne({ jobCircular: circular._id, $or: or }).select('_id');
    payload.alreadyApplied = !!existing;
  } else {
    payload.alreadyApplied = false;
  }
  return payload;
};

const applyForJob = async (user, circularId, { applicant, answers }) => {
  const circular = await JobCircular.findById(circularId);
  if (!circular || circular.status !== 'active') throw ApiError.notFound('Active job circular not found');
  if (!applicant?.email || !applicant?.name) throw ApiError.badRequest('Applicant name and email are required');

  if (user) {
    const userDoc = await User.findById(user._id);
    const p = userDoc?.profile || {};
    const hasAddress = Boolean((p.address || p.location || '').trim());
    const hasFatherName = Boolean((p.fatherName || '').trim());
    const hasMotherName = Boolean((p.motherName || '').trim());
    const hasEducation = Array.isArray(p.education) && p.education.length > 0 && p.education.some(e => (e.institution || e.degree));
    const hasSkills = (Array.isArray(p.skills) && p.skills.length > 0) || (typeof p.skills === 'string' && p.skills.trim().length > 0);

    if (!hasAddress || !hasFatherName || !hasMotherName || !hasEducation || !hasSkills) {
      throw ApiError.badRequest('Please complete your profile (Basic Information: Address, Father Name, Mother Name; Educational Information; and Skills) before applying.');
    }
  }

  const emailNorm = String(applicant.email).toLowerCase().trim();
  const linkedUserId = user?._id || null;
  const duplicateOr = [{ 'applicant.email': emailNorm }];
  if (linkedUserId) duplicateOr.push({ user: linkedUserId });
  const existing = await Application.findOne({ jobCircular: circular._id, $or: duplicateOr }).select('_id');
  if (existing) throw ApiError.conflict('You have already applied for this position.');

  const application = new Application({
    jobCircular: circular._id,
    company: circular.company,
    user: linkedUserId || undefined,
    applicant: { ...applicant, email: emailNorm },
    answers
  });
  await application.save();

  const company = await Company.findById(circular.company);
  if (company && company.owner) {
    const ownerNotif = await Notification.create({
      user: company.owner,
      company: company._id,
      type: 'job_application',
      title: 'New Job Application',
      message: `${applicant.name} has applied for the "${circular.title}" position.`,
      relatedId: application._id,
      relatedModel: 'Application',
      metadata: { circularId: circular._id }
    });
    emitSocketNotification(null, company.owner, ownerNotif);
  }
  return { message: 'Application submitted successfully!', applicationId: application._id };
};

const getApplicants = async (user, circularId) => {
  await requireRecruitmentPermission(user.company, user._id);
  const apps = await Application.find({ jobCircular: circularId }).lean();
  const emailsNeedingUser = [...new Set(
    apps.filter((a) => !a.user && a.applicant?.email).map((a) => String(a.applicant.email).toLowerCase().trim())
  )];
  let emailToUserId = new Map();
  if (emailsNeedingUser.length) {
    const matched = await User.find({ email: { $in: emailsNeedingUser } }).select('_id email').lean();
    emailToUserId = new Map(matched.map((u) => [u.email, u._id]));
  }
  const backfillIds = [];
  const payload = apps.map((app) => {
    if (app.user) return app;
    const em = app.applicant?.email && String(app.applicant.email).toLowerCase().trim();
    const resolved = em && emailToUserId.get(em);
    if (resolved) {
      backfillIds.push({ _id: app._id, user: resolved });
      return { ...app, user: resolved };
    }
    return app;
  });
  if (backfillIds.length) {
    await Promise.all(backfillIds.map(({ _id, user }) => Application.updateOne({ _id }, { $set: { user } }).exec()));
  }
  return payload;
};

const getApplicationById = async (user, applicationId) => {
  const application = await Application.findById(applicationId).populate('jobCircular');
  if (!application) throw ApiError.notFound('Application not found');
  if (application.company.toString() !== user.company.toString()) throw ApiError.forbidden('Unauthorized access');
  if (!application.user && application.applicant?.email) {
    const u = await User.findOne({ email: application.applicant.email.toLowerCase().trim() }).select('_id');
    if (u) {
      application.user = u._id;
      await application.save();
      await application.populate('jobCircular');
    }
  }
  return application;
};

const updateApplicationStatus = async (user, applicationId, body) => {
  const { status, notes, interviewDate } = body;
  const application = await Application.findById(applicationId).populate('jobCircular');
  if (!application) throw ApiError.notFound('Application not found');
  if (application.company.toString() !== user.company.toString()) throw ApiError.forbidden('Unauthorized access');

  const wasHired = application.status === 'hired';
  const offerAccepted = application.offerLetterStatus === 'accepted';
  if (wasHired && status !== 'hired') {
    if (offerAccepted && application.user) {
      const company = await Company.findById(application.company);
      const uid = application.user.toString();
      if (company && company.owner.toString() !== uid) {
        company.members = company.members.filter((m) => m.user.toString() !== uid);
        await company.save();
      }
      const stillMember = await Company.findOne({
        $or: [{ owner: application.user }, { 'members.user': application.user }]
      }).select('_id');
      await User.findByIdAndUpdate(application.user, { company: stillMember ? stillMember._id : null });
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
      notes,
      scheduledBy: user._id,
      status: 'scheduled'
    });
    try {
      const applicantEmail = application.applicant?.email;
      const applicantName = application.applicant?.name || 'Applicant';
      const companyInfo = application.company ? await Company.findById(application.company).select('name') : null;
      const companyName = companyInfo?.name || 'A company';
      const jobTitle = application.jobCircular?.title || 'the position';
      const dateObj = new Date(interviewDate);
      const formattedDate = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
      }) : String(interviewDate);
      let notifyUserId = application.user;
      if (!notifyUserId && applicantEmail) {
        const u = await User.findOne({ email: applicantEmail }).select('_id').lean();
        notifyUserId = u?._id;
      }
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
        emitSocketNotification(null, notifyUserId, notif);
      }
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
      console.error('Error sending interview notification:', err);
    }
  }
  await application.save();
  await application.populate('jobCircular');
  return application;
};

const hireCandidate = async (user, applicationId, body) => {
  const { salary, roleDescription, facilities, policies } = body;
  const application = await Application.findById(applicationId).populate('jobCircular');
  if (!application) throw ApiError.notFound('Application not found');
  const company = await requireRecruitmentPermission(user.company, user._id);
  if (application.company.toString() !== company._id.toString()) throw ApiError.forbidden('Unauthorized access');

  application.status = 'hired';
  application.offeredSalary = { amount: salary, currency: company.currency || 'USD' };
  application.hiredAt = new Date();
  application.hiredBy = user._id;
  application.offerLetterStatus = 'pending';
  if (roleDescription != null && typeof roleDescription === 'string') {
    application.hireRoleDescription = roleDescription.slice(0, MAX_TEXT_LENGTH);
  }
  if (facilities != null && typeof facilities === 'string') {
    application.hireFacilities = facilities.slice(0, MAX_TEXT_LENGTH);
  }
  if (policies != null && typeof policies === 'string') {
    application.hirePolicies = policies.slice(0, MAX_TEXT_LENGTH);
  }
  await application.save();
  await application.populate('jobCircular');

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
    emitSocketNotification(null, notifyUserId, offerNotif);
  }
  return { message: 'Candidate hired successfully!', application };
};

const getOfferLetterDetails = async (user, applicationId) => {
  const application = await Application.findById(applicationId)
    .populate('company', 'name logo currency')
    .populate('jobCircular', 'title role');
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status !== 'hired') throw ApiError.badRequest('There is no offer associated with this application.');
  if (!applicantMatchesUser(application, user)) throw ApiError.forbidden('You are not authorized to view this offer.');
  if (application.offerLetterStatus === 'accepted') {
    return { phase: 'accepted', companyId: application.company._id, companyName: application.company.name };
  }
  if (application.offerLetterStatus === 'pending') {
    return {
      phase: 'pending',
      applicationId: application._id,
      company: application.company,
      jobTitle: application.jobCircular?.title,
      role: application.jobCircular?.role,
      offeredSalary: application.offeredSalary,
      hireRoleDescription: application.hireRoleDescription || '',
      applicantName: application.applicant?.name
    };
  }
  if (!application.offerLetterStatus || application.offerLetterStatus === 'none') {
    throw ApiError.badRequest('This hire does not include an online offer letter. Contact the employer if you need access.');
  }
  if (application.offerLetterStatus === 'declined') throw ApiError.badRequest('This offer was declined.');
  throw ApiError.badRequest('This offer is no longer available.');
};

const acceptOfferLetter = async (user, applicationId) => {
  const application = await Application.findById(applicationId).populate('jobCircular');
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status !== 'hired') throw ApiError.badRequest('Invalid application state.');
  if (application.offerLetterStatus !== 'pending') {
    if (application.offerLetterStatus === 'accepted') throw ApiError.badRequest('You have already accepted this offer.');
    if (!application.offerLetterStatus || application.offerLetterStatus === 'none') {
      throw ApiError.badRequest('This hire does not use online offer acceptance. Contact the employer if you need access.');
    }
    throw ApiError.badRequest('This offer is no longer available.');
  }
  if (!applicantMatchesUser(application, user)) throw ApiError.forbidden('You are not authorized to accept this offer.');
  const userId = user._id;
  if (application.user && application.user.toString() !== userId.toString()) {
    throw ApiError.forbidden('Sign in as the applicant account linked to this application.');
  }
  if (!application.user) application.user = userId;

  const company = await Company.findById(application.company);
  if (!company) throw ApiError.notFound('Company not found');
  const ownerId = company.owner.toString();
  const alreadyMember = ownerId === userId.toString() || company.members.some((m) => m.user.toString() === userId.toString());
  if (!alreadyMember) {
    const salary = Number(application.offeredSalary?.amount) || 0;
    let designation = application.jobCircular?.role || 'Employee';
    const designationNames = new Set((company.designations || []).map((d) => d.name));
    if (!designationNames.has(designation)) designation = 'Employee';
    const newMember = { user: userId, designation, currentSalary: salary, joinedAt: new Date() };
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
  return { message: 'Welcome aboard! You are now part of the team.', companyId: company._id };
};

const getCompanyStats = async (user) => {
  const companyId = user.company;
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');
  await requireRecruitmentPermission(companyId, user._id);
  const [totalCirculars, totalApplicants, statusStats] = await Promise.all([
    JobCircular.countDocuments({ company: companyId }),
    Application.countDocuments({ company: companyId }),
    Application.aggregate([{ $match: { company: companyId } }, { $group: { _id: '$status', count: { $sum: 1 } } }])
  ]);
  return {
    totalCirculars,
    totalApplicants,
    shortlisted: statusStats.find((s) => s._id === 'shortlisted')?.count || 0,
    interviewed: statusStats.find((s) => s._id === 'interviewed')?.count || 0,
    hired: statusStats.find((s) => s._id === 'hired')?.count || 0
  };
};

const updateCircular = async (user, circularId, body) => {
  const circular = await JobCircular.findById(circularId);
  if (!circular) throw ApiError.notFound('Circular not found');
  if (circular.company.toString() !== user.company.toString()) throw ApiError.forbidden('Unauthorized access');
  await requireRecruitmentPermission(user.company, user._id);
  circular.title = body.title || circular.title;
  circular.role = body.role || circular.role;
  circular.salaryRange = body.salaryRange || circular.salaryRange;
  circular.experience = body.experience !== undefined ? body.experience : circular.experience;
  circular.description = body.description || circular.description;
  circular.jobNature = body.jobNature || circular.jobNature;
  circular.location = body.location || circular.location;
  circular.benefits = body.benefits || circular.benefits;
  circular.mandatorySkills = body.mandatorySkills || circular.mandatorySkills;
  circular.niceToHaveSkills = body.niceToHaveSkills || circular.niceToHaveSkills;
  circular.questions = body.questions || circular.questions;
  circular.status = body.status || circular.status;
  if (body.deadline !== undefined) circular.deadline = body.deadline || undefined;
  await circular.save();
  return circular;
};

const deleteCircular = async (user, circularId) => {
  const circular = await JobCircular.findById(circularId);
  if (!circular) throw ApiError.notFound('Circular not found');
  if (circular.company.toString() !== user.company.toString()) throw ApiError.forbidden('Unauthorized access');
  await requireRecruitmentPermission(user.company, user._id);
  await JobCircular.findByIdAndDelete(circularId);
  return { message: 'Circular deleted successfully' };
};

module.exports = {
  createCircular,
  getPublicCirculars,
  getCircularDetails,
  applyForJob,
  getApplicants,
  getApplicationById,
  updateApplicationStatus,
  hireCandidate,
  getOfferLetterDetails,
  acceptOfferLetter,
  getCompanyStats,
  updateCircular,
  deleteCircular
};
