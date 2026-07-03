const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const { validateSignup, validateSignin } = require('../middleware/validation');
const validate = require('../middleware/validate');

// Traditional auth routes
router.post('/signup', validateSignup, validate, authController.signup);
router.post('/signin', validateSignin, validate, authController.signin);

// Google OAuth routes
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your-google-client-id-here') {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/signin?error=${encodeURIComponent('Google OAuth is not configured.')}`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { 
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/signin` 
    })(req, res, next);
  },
  authController.socialLoginSuccess
);

// GitHub OAuth routes
router.get('/github', (req, res, next) => {
  if (!process.env.GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID === 'your-github-client-id-here') {
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/signin?error=${encodeURIComponent('GitHub OAuth is not configured.')}`);
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

router.get('/github/callback',
  (req, res, next) => {
    passport.authenticate('github', { 
      failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3000'}/signin` 
    })(req, res, next);
  },
  authController.socialLoginSuccess
);

module.exports = router;