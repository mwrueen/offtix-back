const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const syncPendingInvitationNotifications = require('../utils/syncPendingInvitationNotifications');

const TOKEN_TTL = '7d';

/** Sign a 7-day JWT for the given user id. */
const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

/** Shape a User document into the public payload returned to clients. */
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  profile: user.profile
});

/**
 * Register a new local user, sync any pending invitation notifications and
 * return an auth token alongside the public user payload.
 */
const register = async ({ name, email, password }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw ApiError.badRequest('User already exists');
  }

  const user = new User({ name, email, password });
  await user.save();
  await syncPendingInvitationNotifications(user);

  return { token: generateToken(user._id), user: toPublicUser(user) };
};

/**
 * Authenticate a local user by email/password, sync pending invitation
 * notifications and return an auth token with the public user payload.
 */
const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  await syncPendingInvitationNotifications(user);

  return { token: generateToken(user._id), user: toPublicUser(user) };
};

module.exports = { generateToken, toPublicUser, register, login };
