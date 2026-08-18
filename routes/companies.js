const express = require('express');
const router = express.Router();
const companyController = require('../controllers/companyController');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const createUploader = require('../utils/uploadHelper');

// Configure multer for company logo uploads
const upload = createUploader({
  destination: 'uploads/company-logos',
  prefix: 'logo',
  limitSize: 5 * 1024 * 1024, // 5MB limit
  onlyImages: true
});

router.post('/', authenticate, companyController.createCompany);
router.get('/my-company', authenticate, companyController.getUserCompany);
router.get('/user-companies', authenticate, companyController.getUserCompanies);
router.get('/public/:id', companyController.getPublicCompany);
router.get('/:id', authenticate, companyController.getCompany);
router.put('/:id/profile', authenticate, requirePermission('manageCompanySettings'), companyController.updateCompanyProfile);
router.post('/:id/logo', authenticate, upload.single('logo'), companyController.uploadCompanyLogo);

// Member management — requires addEmployee permission
router.post('/:id/add-member', authenticate, requirePermission('addEmployee'), companyController.addMember);

// Salary & designation update — requires editEmployee permission
router.put('/:id/update-salary', authenticate, requirePermission('editEmployee'), companyController.updateMemberSalary);
router.put('/:id/update-designation', authenticate, requirePermission('editEmployee'), companyController.updateMemberDesignation);

// Role/Designation management — each action checked individually
router.post('/:id/designations', authenticate, requirePermission('createDesignation'), companyController.addDesignation);
router.put('/:id/designation-permissions', authenticate, requirePermission('editDesignation'), companyController.updateDesignationPermissions);
router.delete('/:id/designations/:designationId', authenticate, requirePermission('deleteDesignation'), companyController.deleteDesignation);

// Company Settings Routes — requires manageCompanySettings permission
router.put('/:id/settings', authenticate, requirePermission('manageCompanySettings'), companyController.updateCompanySettings);
router.post('/:id/holidays', authenticate, requirePermission('manageCompanySettings'), companyController.addHoliday);
router.delete('/:id/holidays/:holidayId', authenticate, requirePermission('manageCompanySettings'), companyController.removeHoliday);

// Workforce Route - Get employees with their tasks
router.get('/:id/workforce', authenticate, companyController.getWorkforce);

// Organization Hierarchy Routes
router.get('/:id/organogram', authenticate, companyController.getOrganogram);
router.put('/:id/reporting-manager', authenticate, requirePermission('editEmployee'), companyController.updateReportingManager);
router.put('/:id/designation-level', authenticate, requirePermission('manageCompanySettings'), companyController.updateDesignationLevel);

module.exports = router;