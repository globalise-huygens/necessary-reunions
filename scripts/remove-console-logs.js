const fs = require('fs');
const path = require('path');

// Function to safely remove console.log statements
function removeConsoleLogs(content) {
  // Remove complete console.log statements with multi-line support
  // This regex matches console.log(...) including nested parentheses and line breaks
  return content.replace(/console\.log\s*\([^)]*(?:\([^)]*\)[^)]*)*\);?\s*\n?/gms, '');
}

// Function to process a file
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const cleaned = removeConsoleLogs(content);
    
    if (content !== cleaned) {
      fs.writeFileSync(filePath, cleaned);
      console.log(`Cleaned: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Function to process directory recursively
function processDirectory(dirPath, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      processDirectory(fullPath, extensions);
    } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
      processFile(fullPath);
    }
  }
}

// Main execution
const projectRoot = '/Users/neru/projects/necessary-reunions';
const dirsToClean = [
  'app/api',
  'hooks', 
  'components',
  'lib'
];

console.log('Starting console.log cleanup...');

for (const dir of dirsToClean) {
  const fullDirPath = path.join(projectRoot, dir);
  if (fs.existsSync(fullDirPath)) {
    console.log(`Processing ${dir}...`);
    processDirectory(fullDirPath);
  }
}

console.log('Console.log cleanup completed!');