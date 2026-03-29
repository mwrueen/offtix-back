const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const { authenticate } = require('../middleware/auth');

// Public Routes
router.get('/public/circulars', recruitmentController.getPublicCirculars);
router.get('/public/circulars/:id', recruitmentController.getCircularDetails);
router.post('/public/apply/:id', recruitmentController.applyForJob);

// Admin Routes (Private)
router.use(authenticate);
router.post('/circulars', recruitmentController.createCircular);
router.put('/circulars/:id', recruitmentController.updateCircular);
router.delete('/circulars/:id', recruitmentController.deleteCircular);
router.get('/circulars/:id/applicants', recruitmentController.getApplicants);
router.patch('/applications/:id/status', recruitmentController.updateApplicationStatus);
router.post('/applications/:id/hire', recruitmentController.hireCandidate);
router.get('/stats', recruitmentController.getCompanyStats);

module.exports = router;
