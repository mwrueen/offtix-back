const express = require('express');
const upload = require('./middleware/uploadTaskDocuments');
const app = express();
app.post('/test-upload', upload.array('files', 10), (req, res) => {
  res.json({ files: req.files });
});
app.listen(9999, () => console.log('listening'));
