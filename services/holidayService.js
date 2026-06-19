const Company = require('../models/Company');
const { assertCompanyReadAccess, assertCompanyAdminPermission } = require('../utils/companyAccess');
const ApiError = require('../utils/ApiError');

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  if (dateStr.includes('T')) return new Date(dateStr);
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
};

const holidayDate = (holiday) => (holiday.isRange ? new Date(holiday.startDate) : new Date(holiday.date));

const sortHolidays = (holidays) => holidays.sort((a, b) => holidayDate(a) - holidayDate(b));

const ensureHolidays = (company) => {
  if (!company.settings) company.settings = {};
  if (!company.settings.holidays) company.settings.holidays = [];
};

const getCompanyHolidays = async (companyId, userId) => {
  const { company } = await assertCompanyReadAccess(companyId, userId);
  const holidays = company.settings?.holidays || [];
  return { company: { _id: company._id, name: company.name }, holidays: sortHolidays([...holidays]) };
};

const addHoliday = async (companyId, userId, { date, startDate, endDate, name, description, isRange }) => {
  await assertCompanyAdminPermission(companyId, userId, 'manageCompanySettings');
  const company = await Company.findById(companyId);

  if (!name) throw ApiError.badRequest('Holiday name is required');
  if (isRange) {
    if (!startDate || !endDate) throw ApiError.badRequest('Start date and end date are required for date range holidays');
  } else if (!date) {
    throw ApiError.badRequest('Date is required for single-day holidays');
  }

  ensureHolidays(company);
  let holidayData;
  if (isRange) {
    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);
    if (parsedEndDate < parsedStartDate) throw ApiError.badRequest('End date must be after start date');
    holidayData = { name, description: description || '', isRange: true, startDate: parsedStartDate, endDate: parsedEndDate };
  } else {
    holidayData = { name, description: description || '', isRange: false, date: parseDate(date) };
  }

  company.settings.holidays.push(holidayData);
  company.markModified('settings.holidays');
  const savedCompany = await company.save();
  return { message: 'Holiday added successfully', holidays: savedCompany.settings.holidays };
};

const updateHoliday = async (companyId, holidayId, userId, { date, startDate, endDate, name, description, isRange }) => {
  await assertCompanyAdminPermission(companyId, userId, 'manageCompanySettings');
  const company = await Company.findById(companyId);
  if (!company.settings || !company.settings.holidays) throw ApiError.notFound('No holidays found');
  const holiday = company.settings.holidays.id(holidayId);
  if (!holiday) throw ApiError.notFound('Holiday not found');

  if (isRange !== undefined) {
    holiday.isRange = isRange;
    if (isRange) {
      if (startDate) holiday.startDate = parseDate(startDate);
      if (endDate) holiday.endDate = parseDate(endDate);
      holiday.date = undefined;
    } else {
      if (date) holiday.date = parseDate(date);
      holiday.startDate = undefined;
      holiday.endDate = undefined;
    }
  } else if (holiday.isRange) {
    if (startDate) holiday.startDate = parseDate(startDate);
    if (endDate) holiday.endDate = parseDate(endDate);
  } else {
    if (date) holiday.date = parseDate(date);
  }
  if (name) holiday.name = name;
  if (description !== undefined) holiday.description = description;

  await company.save();
  return { message: 'Holiday updated successfully', holidays: company.settings.holidays };
};

const deleteHoliday = async (companyId, holidayId, userId) => {
  await assertCompanyAdminPermission(companyId, userId, 'manageCompanySettings');
  const company = await Company.findById(companyId);
  if (!company.settings || !company.settings.holidays) throw ApiError.notFound('No holidays found');
  const holiday = company.settings.holidays.id(holidayId);
  if (!holiday) throw ApiError.notFound('Holiday not found');
  holiday.deleteOne();
  await company.save();
  return { message: 'Holiday deleted successfully', holidays: company.settings.holidays };
};

const getUpcomingHolidays = async (companyId, userId, limit = 5) => {
  const { company } = await assertCompanyReadAccess(companyId, userId);
  const holidays = company.settings?.holidays || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingHolidays = holidays
    .filter((h) => holidayDate(h) >= today)
    .sort((a, b) => holidayDate(a) - holidayDate(b))
    .slice(0, parseInt(limit, 10));
  return { company: { _id: company._id, name: company.name }, holidays: upcomingHolidays };
};

module.exports = { getCompanyHolidays, addHoliday, updateHoliday, deleteHoliday, getUpcomingHolidays };
