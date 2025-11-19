const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { validateSignup, validateSignin } = require('../middleware/validation');

// Traditional auth routes
router.post('/signup', validateSignup, authController.signup);
router.post('/signin', validateSignin, authController.signin);

// Google OAuth routes
router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/signin' }),
  authController.socialLoginSuccess
);

// Facebook OAuth routes
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/signin' }),
  authController.socialLoginSuccess
);

module.exports = router;