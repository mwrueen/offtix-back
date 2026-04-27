const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function test() {
  const fileContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
  fs.writeFileSync('test.pdf', fileContent);
  
  const form = new FormData();
  form.append('note', 'Test node upload');
  form.append('files', fs.createReadStream('test.pdf'));
  
  try {
    // You need an auth token though...
    // Let's just mock the auth or skip it.
  } catch (err) {
    console.error(err);
  }
}
