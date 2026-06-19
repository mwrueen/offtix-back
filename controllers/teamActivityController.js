const asyncHandler = require('../utils/asyncHandler');
const teamActivityService = require('../services/teamActivityService');

exports.getTeamActivity = asyncHandler(async (req, res) => {
  const companyIdHeader = req.headers['x-company-id'];
  const companyIdQuery = req.query.companyId;
  const companyId = (companyIdHeader === 'personal' || companyIdQuery === 'personal')
    ? 'personal'
    : (companyIdHeader || companyIdQuery);
  const activity = await teamActivityService.getTeamActivity(req.user._id, {
    companyId,
    projectId: req.query.projectId,
    date: req.query.date
  });
  res.json(activity);
});
