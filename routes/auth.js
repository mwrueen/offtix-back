const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateSignup, validateSignin } = require('../middleware/validation');

router.post('/signup', validateSignup, authController.signup);
router.post('/signin', validateSignin, authController.signin);

module.exports = router;