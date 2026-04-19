const fs = require('fs');
const path = require('path');

const controllers = [
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

controllers.forEach(file => {
  const filePath = path.join(__dirname, 'controllers', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let replaced = false;

  // The bad pattern: member.equals(req.user._id)
  const regex = /const hasAccess = project\.owner\.equals\(req\.user\._id\) \|\|\s*project\.members\.some\(member => member\.equals\(req\.user\._id\)\);/g;

  if (regex.test(content)) {
    content = content.replace(regex, newAccessCheck.trim());
    replaced = true;
  }
  
  if (replaced) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated ' + file);
  } else {
    console.log('No matches found in ' + file);
  }
});
