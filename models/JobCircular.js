const mongoose = require('mongoose');

const jobCircularSchema = new mongoose.Schema({
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        required: true,
        trim: true
    },
    salaryRange: {
        min: { type: Number, required: true },
        max: { type: Number, required: true },
        currency: { type: String, default: 'USD' }
    },
    experience: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    jobNature: {
        type: String,
        enum: ['remote', 'on-site', 'hybrid'],
        default: 'remote'
    },
    location: {
        type: String,
        trim: true
    },
    benefits: {
        type: String,
        trim: true
    },
    mandatorySkills: [{
        type: String,
        trim: true
    }],
    niceToHaveSkills: [{
        type: String,
        trim: true
    }],
    questions: [{
        question: { type: String, required: true },
        type: {
            type: String,
            enum: ['text', 'long-text', 'selection', 'radio', 'checkbox'],
            default: 'text'
        },
        options: [String], // for selection/radio/checkbox
        required: { type: Boolean, default: true }
    }],
    status: {
        type: String,
        enum: ['active', 'closed', 'paused', 'draft'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('JobCircular', jobCircularSchema);
