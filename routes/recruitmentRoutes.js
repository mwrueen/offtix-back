const express = require('express');
const router = express.Router();
const recruitmentController = require('../controllers/recruitmentController');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  validateRecruitmentCircular,
  validateRecruitmentCircularUpdate,
  validateJobApplication,
  validateApplicationStatus,
  validateHireOffer
} = require('../middleware/validation');

// Public job listings (optional auth for “already applied” on detail)
router.get('/public/circulars', recruitmentController.getPublicCirculars);
router.get('/public/circulars/:id', optionalAuthenticate, recruitmentController.getCircularDetails);
router.post('/public/apply/:id', authenticate, validateJobApplication, validate, recruitmentController.applyForJob);

const createUploader = require('../utils/uploadHelper');

// Configure multer for circular images
const upload = createUploader({
  destination: 'uploads/circular-images',
  allowedTypes: /jpeg|jpg|png|webp/
});

// Admin Routes (Private)
router.use(authenticate);
router.get('/circulars', recruitmentController.getCompanyCirculars);
router.post('/circulars', validateRecruitmentCircular, validate, recruitmentController.createCircular);
router.put('/circulars/:id', validateRecruitmentCircularUpdate, validate, recruitmentController.updateCircular);
router.post('/circulars/:id/image', upload.single('image'), recruitmentController.uploadCircularImage);
router.delete('/circulars/:id', recruitmentController.deleteCircular);
router.get('/circulars/:id/applicants', recruitmentController.getApplicants);
router.get('/applications/:id', recruitmentController.getApplicationById);
router.patch('/applications/:id/status', validateApplicationStatus, validate, recruitmentController.updateApplicationStatus);
router.post('/applications/:id/hire', validateHireOffer, validate, recruitmentController.hireCandidate);
router.get('/applications/:id/offer-details', recruitmentController.getOfferLetterDetails);
router.post('/applications/:id/accept-offer', recruitmentController.acceptOfferLetter);
router.get('/stats', recruitmentController.getCompanyStats);

module.exports = router;
