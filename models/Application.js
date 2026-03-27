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
    applicant: {
        name: { type: String, required: true },
        email: { type: String, required: true, lowercase: true },
        phone: { type: String, required: true },
        resumeUrl: { type: String },
        portfolioUrl: { type: String },
        experience: { type: Number, required: true },
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
    hiredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

module.exports = mongoose.model('Application', applicationSchema);
