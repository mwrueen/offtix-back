const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');

// Configure multer for company logo uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/company-logos');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

router.post('/', authenticate, companyController.createCompany);
router.get('/my-company', authenticate, companyController.getUserCompany);
router.get('/user-companies', authenticate, companyController.getUserCompanies);
router.get('/:id', authenticate, companyController.getCompany);
router.put('/:id/profile', authenticate, companyController.updateCompanyProfile);
router.post('/:id/logo', authenticate, upload.single('logo'), companyController.uploadCompanyLogo);
router.post('/:id/add-member', authenticate, companyController.addMember);
router.put('/:id/update-salary', authenticate, companyController.updateMemberSalary);
router.put('/:id/update-designation', authenticate, companyController.updateMemberDesignation);
router.post('/:id/designations', authenticate, companyController.addDesignation);
router.put('/:id/designation-permissions', authenticate, companyController.updateDesignationPermissions);
router.delete('/:id/designations/:designationId', authenticate, companyController.deleteDesignation);

// Company Settings Routes
router.put('/:id/settings', authenticate, companyController.updateCompanySettings);
router.post('/:id/holidays', authenticate, companyController.addHoliday);
router.delete('/:id/holidays/:holidayId', authenticate, companyController.removeHoliday);

// Workforce Route - Get employees with their tasks
router.get('/:id/workforce', authenticate, companyController.getWorkforce);

// Organization Hierarchy Routes
router.get('/:id/organogram', authenticate, companyController.getOrganogram);
router.put('/:id/reporting-manager', authenticate, companyController.updateReportingManager);
router.put('/:id/designation-level', authenticate, companyController.updateDesignationLevel);

module.exports = router;