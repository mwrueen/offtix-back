const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/adminService');

exports.getStats = asyncHandler(async (req, res) => {
    const stats = await adminService.getStats(req.user);
    res.json(stats);
});

exports.getAllCompanies = asyncHandler(async (req, res) => {
    const companies = await adminService.getAllCompanies(req.user);
    res.json(companies);
});

exports.getCompanyDetails = asyncHandler(async (req, res) => {
    const company = await adminService.getCompanyDetails(req.user, req.params.id);
    res.json(company);
});

exports.getCompanyProjects = asyncHandler(async (req, res) => {
    const projects = await adminService.getCompanyProjects(req.user, req.params.id);
    res.json(projects);
});
