const Company = require('../models/Company');
const User = require('../models/User');
const Project = require('../models/Project');
const ApiError = require('../utils/ApiError');

const requireSuperadmin = (user) => {
  if (user.role !== 'superadmin') {
    throw ApiError.forbidden('Access denied. Only superadmin can view statistics.');
  }
};

const requireAdminOrSuperadmin = (user) => {
  if (!['admin', 'superadmin'].includes(user.role)) {
    throw ApiError.forbidden('Access denied. Only superadmin and admin can view this resource.');
  }
};

const getStats = async (user) => {
  requireSuperadmin(user);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [totalCompanies, totalUsers, activeUsers, adminUsers] = await Promise.all([
    Company.countDocuments(),
    User.countDocuments(),
    User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } }),
    User.countDocuments({ role: { $in: ['admin', 'superadmin'] } })
  ]);

  return { totalCompanies, totalUsers, activeUsers, adminUsers };
};

const getAllCompanies = async (user) => {
  requireAdminOrSuperadmin(user);
  const companies = await Company.find()
    .populate('owner', 'name email')
    .select('name description industry website email phone address city state country zipCode foundedYear companySize currency members owner createdAt logo')
    .lean();

  return companies.map((company) => ({
    id: company._id,
    name: company.name,
    description: company.description,
    industry: company.industry,
    website: company.website,
    email: company.email,
    phone: company.phone,
    address: company.address,
    city: company.city,
    state: company.state,
    country: company.country,
    zipCode: company.zipCode,
    foundedYear: company.foundedYear,
    companySize: company.companySize,
    currency: company.currency,
    memberCount: company.members?.length || 0,
    owner: company.owner,
    createdAt: company.createdAt,
    logo: company.logo
  }));
};

const getCompanyDetails = async (user, companyId) => {
  requireAdminOrSuperadmin(user);
  const company = await Company.findById(companyId)
    .populate('owner', 'name email avatar')
    .populate('members.user', 'name email avatar role')
    .lean();
  if (!company) throw ApiError.notFound('Company not found');
  return { ...company, memberCount: company.members?.length || 0 };
};

const getCompanyProjects = async (user, companyId) => {
  requireAdminOrSuperadmin(user);
  return Project.find({ company: companyId })
    .populate('owner', 'name email')
    .populate('members.user', 'name email')
    .sort({ createdAt: -1 })
    .lean();
};

module.exports = { getStats, getAllCompanies, getCompanyDetails, getCompanyProjects };
