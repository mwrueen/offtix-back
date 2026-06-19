const Company = require('../models/Company');
const User = require('../models/User');
const ApiError = require('./ApiError');

const loadCompany = async (companyId) => {
  const company = await Company.findById(companyId);
  if (!company) throw ApiError.notFound('Company not found');
  return company;
};

const isCompanyMember = (company, userId) =>
  company.owner.toString() === userId.toString() ||
  company.members.some((m) => m.user.toString() === userId.toString());

const hasCompanyAdminPermission = (company, user, permission) => {
  if (user.role === 'superadmin') return true;
  if (company.owner.toString() === user._id.toString()) return true;
  const member = company.members.find((m) => m.user.toString() === user._id.toString());
  if (!member) return false;
  const designation = company.designations.find((d) => d.name === member.designation);
  return !!(designation && designation.permissions && designation.permissions[permission]);
};

const assertCompanyReadAccess = async (companyId, userId) => {
  const [company, user] = await Promise.all([loadCompany(companyId), User.findById(userId)]);
  if (!isCompanyMember(company, userId)) {
    throw ApiError.forbidden('Access denied to this company');
  }
  return { company, user };
};

const assertCompanyAdminPermission = async (companyId, userId, permission) => {
  const [company, user] = await Promise.all([loadCompany(companyId), User.findById(userId)]);
  if (!hasCompanyAdminPermission(company, user, permission)) {
    throw ApiError.forbidden(`You do not have permission to ${permission.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
  }
  return { company, user };
};

module.exports = {
  loadCompany,
  isCompanyMember,
  hasCompanyAdminPermission,
  assertCompanyReadAccess,
  assertCompanyAdminPermission
};
