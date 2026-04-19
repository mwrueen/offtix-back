const fs = require('fs');
const path = require('path');

const controllers = [
  'taskStatusController.js',
  'sprintController.js',
  'phaseController.js',
  'taskRoleController.js',
  'meetingNoteController.js',
  'requirementController.js'
];

const newAccessCheck = `
    let hasAccess = false;
    const user = await require('../models/User').findById(req.user._id);
    if (user && user.role === 'superadmin') hasAccess = true;
    else if (project.owner.equals(req.user._id)) hasAccess = true;
    else if (project.members.some(m => (m.user?._id || m.user).toString() === req.user._id.toString())) hasAccess = true;
    else if (project.company) {
      const company = await require('../models/Company').findById(project.company);
      if (company && company.owner.toString() === req.user._id.toString()) hasAccess = true;
    }
`;

const oldPatternList = [
  // Pattern 1
  `    const hasAccess = project.owner.equals(req.user._id) ||
      project.members.some(member => (member.user?._id || member.user).toString() === req.user._id.toString());`,
  // Pattern 2
  `    const hasAccess = project.owner.equals(req.user._id) || project.members.some(m => (m.user?._id || m.user).toString() === req.user._id.toString());`
];

controllers.forEach(file => {
  const filePath = path.join(__dirname, 'controllers', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let replaced = false;

  oldPatternList.forEach(pattern => {
    if (content.includes(pattern)) {
      content = content.replaceAll(pattern, newAccessCheck.trim());
      replaced = true;
    }
  });

  // Also replace explicit 'Only project owner can manage' error
  const ownerOnlyPattern1 = `    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can manage task statuses' });
    }`;
  if (content.includes(ownerOnlyPattern1)) {
    content = content.replace(ownerOnlyPattern1, `${newAccessCheck.trim()}\n    if (!hasAccess) {\n      return res.status(403).json({ error: 'Access denied' });\n    }`);
    replaced = true;
  }

  const ownerOnlyPattern2 = `    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ error: 'Only project owner can manage task roles' });
    }`;
  if (content.includes(ownerOnlyPattern2)) {
    content = content.replace(ownerOnlyPattern2, `${newAccessCheck.trim()}\n    if (!hasAccess) {\n      return res.status(403).json({ error: 'Access denied' });\n    }`);
    replaced = true;
  }
  
  if (replaced) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
  } else {
    console.log('No matches found in ' + file);
  }
});
