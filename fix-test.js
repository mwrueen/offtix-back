const fs = require('fs');
const contents = fs.readFileSync('uploads/task-documents/task-doc-1777310208770-539547850.pdf', 'utf8');
try {
  const parsed = JSON.parse(contents);
  if (parsed.data) {
    fs.writeFileSync('restored.pdf', Buffer.from(parsed.data));
    console.log("Restored successfully");
  } else {
    // maybe it's just keys like "0": 37, "1": 80
    const keys = Object.keys(parsed).filter(k => !isNaN(parseInt(k)));
    const buf = Buffer.alloc(keys.length);
    for (let i = 0; i < keys.length; i++) buf[i] = parsed[i];
    fs.writeFileSync('restored.pdf', buf);
    console.log("Restored from keyed object");
  }
} catch (e) {
  console.log(e);
}
