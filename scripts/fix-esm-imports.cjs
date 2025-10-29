/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
const console = require('console');
const fs = require('fs');
const path = require('path');
const process = require('process');
const { URL } = require('url');

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
    const ensureExtension = (importPath) => {
      const hasExtension = /\.[a-z0-9]+$/i.test(
        importPath.split('/').pop() || ''
      );
      if (hasExtension) {
        return importPath;
      }

      const sourceDir = path.dirname(filePath);
      const resolvedPath = path.resolve(sourceDir, importPath);
      const candidateFile = `${resolvedPath}.js`;

      if (fs.existsSync(candidateFile)) {
        modified = true;
        return `${importPath}.js`;
      }

      if (
        fs.existsSync(resolvedPath) &&
        fs.statSync(resolvedPath).isDirectory()
      ) {
        modified = true;
        return `${importPath}/index.js`;
      }

      modified = true;
      return `${importPath}.js`;
    };

    const fixedContent = content
      .replace(/from\s+['"](\.[^'"]*?)['"];?/g, (match, importPath) => {
        const updatedPath = ensureExtension(importPath);
        return match.replace(importPath, updatedPath);
      })
      .replace(
        /import\s*\(\s*['"](\.[^'"]*?)['"](?:\s*,\s*[^)]+)?\s*\)/g,
        (match, importPath) => {
          const updatedPath = ensureExtension(importPath);
          return match.replace(importPath, updatedPath);
        }
      );

    if (modified) {
      fs.writeFileSync(filePath, fixedContent, 'utf8');
      console.log(`Fixed imports in: ${filePath}`);
      fixedFiles++;

      // Special handling for index.js decorators import
      if (
        filePath.endsWith('index.js') &&
        fixedContent.includes('./decorators')
      ) {
        console.log('Fixed decorators import in index.js');
      }
    }
  }

  processDirectory(esmDir);

  console.log(
    `ES module imports fixed successfully! Fixed ${fixedFiles} files.`
  );
}

// Check if the script is run directly
if (require.main === module) {
  fixESMImports();
}
