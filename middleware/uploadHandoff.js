const createUploader = require('../utils/uploadHelper');

const upload = createUploader({
  destination: 'uploads/handoff-files',
  prefix: 'handoff',
  limitSize: 50 * 1024 * 1024 // 50MB limit for handoff files
});

module.exports = upload;


