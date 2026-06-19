const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

exports.getUsers = asyncHandler(async (req, res) => {
  const companyId = req.headers['x-company-id'] || req.query.companyId;
  const result = await userService.listUsers({
    companyId,
    requesterId: req.user._id,
    search: req.query.search,
    paginated: req.query.paginated === 'true',
    page: parseInt(req.query.page, 10) || 1,
    limit: parseInt(req.query.limit, 10) || 10
  });
  res.json(result);
});

exports.createUser = asyncHandler(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(201).json(user);
});

exports.getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  res.json(user);
});

exports.updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.json(user);
});

exports.deleteUser = asyncHandler(async (req, res) => {
  await userService.deleteUser(req.params.id);
  res.json({ message: 'User deleted successfully' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await userService.getProfile(req.user._id);
  res.json(user);
});

exports.getCompanyEmployees = asyncHandler(async (req, res) => {
  const users = await userService.getCompanyEmployees(req.params.companyId, req.user._id);
  res.json(users);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const user = await userService.updateProfile(req.user._id, req.body);
  res.json(user);
});

exports.uploadPhoto = asyncHandler(async (req, res) => {
  const user = await userService.uploadPhoto(req.user._id, req.files);
  res.json(user);
});

exports.updateUserPassword = asyncHandler(async (req, res) => {
  await userService.updateUserPassword(req.user, req.params.id, req.body.password);
  res.json({ message: 'Password updated successfully' });
});

exports.exportResumePDF = asyncHandler(async (req, res) => {
  const { pdfBuffer, filename } = await userService.exportResume(req.params.id);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
});
