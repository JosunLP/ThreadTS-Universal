const fs = require('fs');
const path = require('path');

function fixESMImports() {
  console.log('Fixing ES module imports...');
  
  const esmDir = path.join(__dirname, '..', 'dist', 'esm');
  
  if (!fs.existsSync(esmDir)) {
    console.log('ESM directory not found');
    return;
  }
  
  let fixedFiles = 0;
  
  function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (file.endsWith('.js')) {
        processJSFile(fullPath);
      }
    }
  }
  
  function processJSFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Fix relative imports to include .js extension
    const fixedContent = content.replace(
      /from\s+['"](\.[^'"]*?)['"];?/g,
      (match, importPath) => {
        // Don't modify if already has extension or is not a relative import
        if (importPath.includes('.') && importPath.match(/\.[a-z]+$/)) {
          return match;
        }
        
        modified = true;
        return match.replace(importPath, importPath + '.js');
      }
    ).replace(
      /import\s*\(\s*['"](\.[^'"]*?)['"](?:\s*,\s*[^)]+)?\s*\)/g,
      (match, importPath) => {
        // Don't modify if already has extension or is not a relative import
        if (importPath.includes('.') && importPath.match(/\.[a-z]+$/)) {
          return match;
        }
        
        modified = true;
        return match.replace(importPath, importPath + '.js');
      }
    );
    
    if (modified) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`Fixed imports in: ${filePath}`);
      fixedFiles++;
      
      // Special handling for index.js decorators import
      if (filePath.endsWith('index.js') && fixedContent.includes('./decorators')) {
        console.log('Fixed decorators import in index.js');
      }
    }
  }
  
  processDirectory(esmDir);
  
  console.log(`ES module imports fixed successfully! Fixed ${fixedFiles} files.`);
}

if (require.main === module) {
  fixESMImports();
}

module.exports = fixESMImports;
