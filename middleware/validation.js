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
    .isIn(['planning', 'active', 'completed', 'on-hold'])
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