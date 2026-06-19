const Company = require('../models/Company');
const User = require('../models/User');
const { assertCompanyReadAccess, assertCompanyAdminPermission } = require('../utils/companyAccess');
const ApiError = require('../utils/ApiError');

const populateCompany = async (companyId) =>
  Company.findById(companyId)
    .populate('owner', 'name email profile')
    .populate('members.user', 'name email profile createdAt');

const toEmployee = (userDoc, memberDoc, company, isOwner) => ({
  _id: userDoc._id,
  memberId: memberDoc?._id,
  name: userDoc.name,
  email: userDoc.email,
  profile: userDoc.profile,
  designation: memberDoc?.designation || (isOwner ? 'Owner' : undefined),
  currentSalary: memberDoc?.currentSalary || 0,
  salaryHistory: memberDoc?.salaryHistory || [],
  joinedAt: memberDoc?.joinedAt || company.createdAt,
  isOwner,
  createdAt: userDoc.createdAt
});

const buildEmployeeResponse = (company) => {
  const employees = [toEmployee(company.owner, null, company, true)];
  company.members.forEach((member) => {
    if (member.user && member.user._id.toString() !== company.owner._id.toString()) {
      employees.push(toEmployee(member.user, member, company, false));
    }
  });
  return {
    company: {
      _id: company._id,
      name: company.name,
      description: company.description,
      currency: company.currency,
      owner: company.owner,
      members: company.members,
      designations: company.designations
    },
    employees,
    designations: company.designations
  };
};

const getCompanyEmployees = async (companyId, userId) => {
  await assertCompanyReadAccess(companyId, userId);
  const company = await populateCompany(companyId);
  return buildEmployeeResponse(company);
};

const getEmployeeDetails = async (companyId, employeeId, userId) => {
  await assertCompanyReadAccess(companyId, userId);
  const company = await populateCompany(companyId);
  let employee = null;

  if (company.owner._id.toString() === employeeId) {
    employee = toEmployee(company.owner, null, company, true);
  } else {
    const member = company.members.find((m) => m.user._id.toString() === employeeId);
    if (member) employee = toEmployee(member.user, member, company, false);
  }
  if (!employee) throw ApiError.notFound('Employee not found');

  return {
    company: {
      _id: company._id,
      name: company.name,
      description: company.description,
      currency: company.currency
    },
    employee,
    designations: company.designations
  };
};

const updateEmployeeDesignation = async (companyId, employeeId, designation, userId) => {
  await assertCompanyAdminPermission(companyId, userId, 'editEmployee');
  const company = await Company.findById(companyId);
  const member = company.members.find((m) => m.user.toString() === employeeId);
  if (!member) throw ApiError.notFound('Employee not found');
  member.designation = designation;
  await company.save();
  const populatedCompany = await populateCompany(company._id);
  return { message: 'Employee designation updated successfully', company: populatedCompany };
};

const updateEmployeeSalary = async (companyId, employeeId, { newSalary, reason }, userId) => {
  await assertCompanyAdminPermission(companyId, userId, 'editEmployee');
  const company = await Company.findById(companyId);
  const member = company.members.find((m) => m.user.toString() === employeeId);
  if (!member) throw ApiError.notFound('Employee not found');
  member.salaryHistory.push({
    amount: newSalary,
    effectiveDate: new Date(),
    reason: reason || 'Salary update',
    updatedBy: userId
  });
  member.currentSalary = newSalary;
  await company.save();
  const populatedCompany = await populateCompany(company._id);
  return { message: 'Employee salary updated successfully', company: populatedCompany };
};

const removeEmployee = async (companyId, employeeId, userId) => {
  await assertCompanyAdminPermission(companyId, userId, 'editEmployee');
  const company = await Company.findById(companyId);
  if (company.owner.toString() === employeeId) {
    throw ApiError.badRequest('Cannot remove company owner');
  }
  const memberIndex = company.members.findIndex((m) => m.user.toString() === employeeId);
  if (memberIndex === -1) throw ApiError.notFound('Employee not found');
  company.members.splice(memberIndex, 1);
  await company.save();
  await User.findByIdAndUpdate(employeeId, { $unset: { company: 1 } });
  return { message: 'Employee removed successfully' };
};

module.exports = {
  getCompanyEmployees,
  getEmployeeDetails,
  updateEmployeeDesignation,
  updateEmployeeSalary,
  removeEmployee
};
