const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
    jobCircular: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'JobCircular',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    applicant: {
        name: { type: String, required: true },
        email: { type: String, required: true, lowercase: true },
        phone: { type: String },
        resumeUrl: { type: String },
        portfolioUrl: { type: String },
        experience: { type: Number },
        skills: [String]
    },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId },
        questionText: String,
        answer: mongoose.Schema.Types.Mixed
    }],
    status: {
        type: String,
        enum: ['pending', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected'],
        default: 'pending'
    },
    interviewHistory: [{
        date: Date,
        notes: String,
        scheduledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['scheduled', 'completed', 'cancelled'] }
    }],
    offeredSalary: {
        amount: Number,
        currency: { type: String, default: 'USD' }
    },
    hiredAt: Date,
    hiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    /** Role / job description text attached to the offer at hire time (may differ from circular copy). */
    hireRoleDescription: { type: String },
    /** After hire: pending until candidate accepts the offer letter; then they are added as a company member. */
    offerLetterStatus: {
        type: String,
        enum: ['none', 'pending', 'accepted', 'declined'],
        default: 'none'
    },
    offerAcceptedAt: { type: Date }
}, {
    timestamps: true
});

module.exports = mongoose.model('Application', applicationSchema);
