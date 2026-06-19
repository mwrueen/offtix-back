const Project = require('../models/Project');
const Company = require('../models/Company');
const User = require('../models/User');
const ApiError = require('./ApiError');

/**
 * Shared project access helper. Loads the project and the requesting user, then
 * computes whether the user is the project owner, a member, a superadmin, or the
 * company owner. Throws a 404 if the project is missing, or a 403 if the user is
 * not authorized.
 *
 * @param {string|ObjectId} projectId
 * @param {string|ObjectId} userId
 * @param {Object}  [options]
 * @param {boolean} [options.requireOwner=false] restrict to project owner (or superadmin)
 * @param {boolean} [options.loadCompany=false]  also return the company document
 * @returns {Promise<{project: Document, user: Document, isOwner: boolean, company?: Document}>}
 */
const assertProjectAccess = async (projectId, userId, options = {}) => {
  const { requireOwner = false, loadCompany = false } = options;

  const project = await Project.findById(projectId);
  if (!project) throw ApiError.notFound('Project not found');

  const user = await User.findById(userId);
  const isSuperadmin = user?.role === 'superadmin';

  const isOwner = project.owner.equals(userId);
  const isMember = project.members.some((m) => {
    const memberUser = m.user?._id || m.user;
    return memberUser.toString() === userId.toString();
  });

  let isCompanyOwner = false;
  let company = null;
  if (project.company) {
    company = await Company.findById(project.company);
    if (company && company.owner.toString() === userId.toString()) {
      isCompanyOwner = true;
    }
  }

  const hasAccess = isSuperadmin || isOwner || isMember || isCompanyOwner;
  if (!hasAccess) {
    throw ApiError.forbidden('Access denied');
  }

  if (requireOwner && !(isOwner || isSuperadmin)) {
    throw ApiError.forbidden('Only project owner can manage this resource');
  }

  const result = { project, user, isOwner };
  if (loadCompany) result.company = company;
  return result;
};

module.exports = { assertProjectAccess };
