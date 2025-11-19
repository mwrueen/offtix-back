const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { validateUser } = require('../middleware/validation');
const upload = require('../middleware/upload');

router.get('/', userController.getUsers);
router.post('/', validateUser, userController.createUser);
router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);
router.post('/upload-photo', authenticate, upload.fields([{ name: 'profilePicture' }, { name: 'coverPhoto' }]), userController.uploadPhoto);
router.get('/company/:companyId', authenticate, userController.getCompanyEmployees);
router.get('/:id', userController.getUserById);
router.put('/:id', validateUser, userController.updateUser);
router.put('/:id/password', authenticate, userController.updateUserPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;