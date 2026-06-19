const User = require('../models/User');
const Company = require('../models/Company');
const puppeteer = require('puppeteer');
const ApiError = require('../utils/ApiError');
const syncPendingInvitationNotifications = require('../utils/syncPendingInvitationNotifications');
const generateResumeHTML = require('../utils/resumeTemplate');

/** True when the user owns or is a member of the company. */
const hasCompanyAccess = (company, userId) =>
  company.owner.toString() === userId.toString() ||
  company.members.some((m) => m.user.toString() === userId.toString());

const listUsers = async ({ companyId, requesterId, search, paginated, page, limit }) => {
  let query = {};

  if (companyId && companyId !== 'personal') {
    const company = await Company.findById(companyId);
    if (!company) throw ApiError.notFound('Company not found');
    if (!hasCompanyAccess(company, requesterId)) {
      throw ApiError.forbidden('Access denied to this company');
    }
    const companyUserIds = [company.owner, ...company.members.map((m) => m.user)];
    query = { _id: { $in: companyUserIds } };
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i');
    query.$or = [{ name: searchRegex }, { email: searchRegex }];
  }

  if (paginated) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).select('-password').skip(skip).limit(limit),
      User.countDocuments(query)
    ]);
    return {
      data: users,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
    };
  }

  return User.find(query).select('-password');
};

const createUser = async (data) => {
  const user = new User(data);
  await user.save();
  await syncPendingInvitationNotifications(user);
  return user;
};

const getUserById = async (id) => {
  const user = await User.findById(id).select('-password');
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const updateUser = async (id, data) => {
  const user = await User.findByIdAndUpdate(id, data, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  return user;
};

const deleteUser = async (id) => {
  const user = await User.findByIdAndDelete(id);
  if (!user) throw ApiError.notFound('User not found');
};

const getProfile = async (userId) => User.findById(userId).select('-password');

const getCompanyEmployees = async (companyId, requesterId) => {
  if (!companyId) throw ApiError.badRequest('Company ID is required');
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');
  if (!hasCompanyAccess(company, requesterId)) {
    throw ApiError.forbidden('Access denied to this company');
  }
  const companyUserIds = [company.owner, ...company.members.map((m) => m.user)];
  return User.find({ _id: { $in: companyUserIds } }).select('-password');
};

const updateProfile = async (userId, { name, profile }) => {
  // Strip base64 image payloads so they are never persisted to the database
  const cleanProfile = { ...profile };
  if (cleanProfile.profilePicture && cleanProfile.profilePicture.startsWith('data:')) {
    delete cleanProfile.profilePicture;
  }
  if (cleanProfile.coverPhoto && cleanProfile.coverPhoto.startsWith('data:')) {
    delete cleanProfile.coverPhoto;
  }
  return User.findByIdAndUpdate(
    userId,
    { name, profile: cleanProfile },
    { new: true }
  ).select('-password');
};

const uploadPhoto = async (userId, files = {}) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const updateData = {};
  if (files.profilePicture) {
    updateData['profile.profilePicture'] = `/uploads/profile-pictures/${files.profilePicture[0].filename}`;
  }
  if (files.coverPhoto) {
    updateData['profile.coverPhoto'] = `/uploads/cover-photos/${files.coverPhoto[0].filename}`;
  }

  return User.findByIdAndUpdate(userId, { $set: updateData }, { new: true }).select('-password');
};

const updateUserPassword = async (requester, id, password) => {
  if (requester.role !== 'superadmin') {
    throw ApiError.forbidden('Access denied. Only superadmin can change user passwords.');
  }
  if (!password || password.length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters long');
  }
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  // Assign + mark modified so the schema pre-save hook re-hashes the password
  user.password = password;
  user.markModified('password');
  await user.save();
};

const exportResume = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.setContent(generateResumeHTML(user), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    return { pdfBuffer, filename: `${user.name.replace(/\s+/g, '_')}_Resume.pdf` };
  } finally {
    await browser.close();
  }
};

module.exports = {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getProfile,
  getCompanyEmployees,
  updateProfile,
  uploadPhoto,
  updateUserPassword,
  exportResume
};
