const { body } = require('express-validator');

exports.validateUser = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false })
];

exports.validateSignup = [
  body('name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Name must be at least 2 characters long'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
];

exports.validateSignin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

exports.validateProject = [
  body('title')
    .trim()
    .isLength({ min: 3 })
    .withMessage('Title must be at least 3 characters long'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long'),
  body('status')
    .optional()
    .isIn(['not_started', 'running', 'paused', 'cancelled', 'closed'])
    .withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority')
];

exports.validateTask = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Title is required'),
  body('priority')
    .optional({ checkFalsy: true })
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority'),
  body('duration.value')
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage('Duration value must be a number'),
  body('duration.unit')
    .optional({ checkFalsy: true })
    .isIn(['minutes', 'hours', 'days', 'weeks'])
    .withMessage('Invalid duration unit')
];

exports.validateRecruitmentCircular = [
  body('title')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Title must be at least 2 characters long'),
  body('role')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Role must be at least 2 characters long'),
  body('description')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long'),
  body('salaryRange.min')
    .isNumeric()
    .withMessage('Minimum salary must be a number'),
  body('salaryRange.max')
    .isNumeric()
    .withMessage('Maximum salary must be a number'),
  body('experience')
    .isNumeric()
    .withMessage('Experience must be a number'),
  body('jobNature')
    .optional()
    .isIn(['remote', 'on-site', 'hybrid'])
    .withMessage('Invalid job nature'),
  body('deadline')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline must be a valid date')
];

exports.validateRecruitmentCircularUpdate = [
  body('title')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Title must be at least 2 characters long'),
  body('role')
    .optional()
    .trim()
    .isLength({ min: 2 })
    .withMessage('Role must be at least 2 characters long'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10 })
    .withMessage('Description must be at least 10 characters long'),
  body('salaryRange.min')
    .optional()
    .isNumeric()
    .withMessage('Minimum salary must be a number'),
  body('salaryRange.max')
    .optional()
    .isNumeric()
    .withMessage('Maximum salary must be a number'),
  body('experience')
    .optional()
    .isNumeric()
    .withMessage('Experience must be a number'),
  body('jobNature')
    .optional()
    .isIn(['remote', 'on-site', 'hybrid'])
    .withMessage('Invalid job nature'),
  body('status')
    .optional()
    .isIn(['active', 'closed', 'paused', 'draft'])
    .withMessage('Invalid circular status'),
  body('deadline')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Deadline must be a valid date')
];

exports.validateJobApplication = [
  body('applicant.name')
    .trim()
    .isLength({ min: 2 })
    .withMessage('Applicant name must be at least 2 characters long'),
  body('applicant.email')
    .isEmail()
    .withMessage('Please provide a valid applicant email')
    .normalizeEmail({ gmail_remove_dots: false })
];

exports.validateApplicationStatus = [
  body('status')
    .isIn(['pending', 'shortlisted', 'interviewed', 'offered', 'hired', 'rejected'])
    .withMessage('Invalid application status'),
  body('interviewDate')
    .optional({ checkFalsy: true })
    .isISO8601()
    .withMessage('Interview date must be a valid date'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string')
];

exports.validateHireOffer = [
  body('salary')
    .isNumeric()
    .withMessage('Salary must be a number'),
  body('roleDescription')
    .optional()
    .isString()
    .withMessage('Role description must be a string'),
  body('facilities')
    .optional()
    .isString()
    .withMessage('Facilities must be a string'),
  body('policies')
    .optional()
    .isString()
    .withMessage('Policies must be a string')
];