#!/usr/bin/env node

/**
 * Post-build script to fix ES module imports by adding .js extensions
 */

const fs = require('fs');
const path = require('path');

// Fix imports in the ESM dist directory
const esmDistPath = path.join(__dirname, '..', 'dist', 'esm');

if (!fs.existsSync(esmDistPath)) {
  console.log('ESM dist directory not found, skipping import fixes');
  process.exit(0);
}

console.log('Fixing ES module imports...');

// Manual fix for specific known issues
const indexJsPath = path.join(esmDistPath, 'index.js');
if (fs.existsSync(indexJsPath)) {
  let content = fs.readFileSync(indexJsPath, 'utf8');

  // Fix the decorators import specifically
  content = content.replace(
    "from './decorators';",
    "from './decorators/index.js';"
  );

  fs.writeFileSync(indexJsPath, content, 'utf8');
  console.log('Fixed decorators import in index.js');
}

// Generic function to fix imports in all files
function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const basePath = path.dirname(filePath);

  // Fix import statements with relative paths
  content = content.replace(
    /(from\s+['"`])(\.\.?\/[^'"`]+?)(['"`])/g,
    (match, beforePath, importPath, quote) => {
      if (!path.extname(importPath)) {
        const resolvedPath = path.resolve(basePath, importPath);

        // Check if it's a directory with index.js
        if (fs.existsSync(path.join(resolvedPath, 'index.js'))) {
          return `${beforePath}${importPath}/index.js${quote}`;
        }
        // Otherwise, just add .js
        return `${beforePath}${importPath}.js${quote}`;
      }
      return match;
    }
  );

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function fixImportsInDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let fixedFiles = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      fixedFiles += fixImportsInDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      if (fixImportsInFile(fullPath)) {
        fixedFiles++;
        console.log(`Fixed imports in: ${fullPath}`);
      }
    }
  }

  return fixedFiles;
}

const fixedFiles = fixImportsInDirectory(esmDistPath);
console.log(`ES module imports fixed successfully! Fixed ${fixedFiles} files.`);
