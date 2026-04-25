const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      console.error(`Auth Error: User not found for ID ${decoded.userId}`);
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification Failed:', error.message);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

/** Sets req.user when a valid Bearer token is present; otherwise continues without error. */
exports.optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return next();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (user) {
      req.user = user;
      const companyHeader = req.header('X-Company-Id');
      if (companyHeader) {
        req.user.company = companyHeader;
      }
    }
    next();
  } catch {
    next();
  }
};