const fs = require('fs');
const path = require('path');

function walk(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walk('./src');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace escaped backticks
  content = content.replace(/\\`/g, '`');
  // Replace escaped $
  content = content.replace(/\\\$/g, '$');
  // Replace double escaped newlines
  content = content.replace(/\\\\n/g, '\\n');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed:', file);
  }
}
