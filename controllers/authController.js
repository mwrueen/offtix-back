const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

exports.signup = asyncHandler(async (req, res) => {
  const result = await authService.register(req.body);
  res.status(201).json(result);
});

exports.signin = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

// Social login success handler (redirect-based OAuth flow)
exports.socialLoginSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(`${process.env.CLIENT_URL}/signin?error=Authentication failed`);
    }

    const token = authService.generateToken(req.user._id);

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  } catch (error) {
    res.redirect(`${process.env.CLIENT_URL}/signin?error=Authentication failed`);
  }
};

// Social login failure handler
exports.socialLoginFailure = (req, res) => {
  res.redirect(`${process.env.CLIENT_URL}/signin?error=Authentication failed`);
};