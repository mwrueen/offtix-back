const createUploader = require('../utils/uploadHelper');

const upload = createUploader({
  destination: (req, file) => {
    return file.fieldname === 'coverPhoto' 
      ? 'uploads/cover-photos' 
      : 'uploads/profile-pictures';
  },
  limitSize: 5 * 1024 * 1024, // 5MB limit
  onlyImages: true
});

module.exports = upload;