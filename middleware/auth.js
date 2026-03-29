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
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;

    // Optional: override company context from header
    const companyHeader = req.header('X-Company-Id');
    if (companyHeader) {
      req.user.company = companyHeader;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};