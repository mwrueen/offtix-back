const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const passport = require('passport');

// Middleware for auth
const auth = passport.authenticate('jwt', { session: false });

// Public Routes
router.get('/public/circulars', recruitmentController.getPublicCirculars);
router.get('/public/circulars/:id', recruitmentController.getCircularDetails);
router.post('/public/apply/:id', recruitmentController.applyForJob);

// Admin Routes (Private)
router.use(auth);
router.post('/circulars', recruitmentController.createCircular);
router.get('/circulars/:id/applicants', recruitmentController.getApplicants);
router.patch('/applications/:id/status', recruitmentController.updateApplicationStatus);
router.post('/applications/:id/hire', recruitmentController.hireCandidate);

module.exports = router;
