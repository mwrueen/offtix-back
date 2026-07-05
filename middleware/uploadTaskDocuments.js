const createUploader = require('../utils/uploadHelper');

const upload = createUploader({
  destination: 'uploads/task-documents',
  prefix: 'task-doc',
  limitSize: 10 * 1024 * 1024 // 10MB limit
});

module.exports = upload;


