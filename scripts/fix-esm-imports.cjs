const console = require('console');
const fs = require('fs');
const path = require('path');
const process = require('process');

const TARGET_EXTENSION = '.mjs';

function fixESMOutputs() {
  console.log('Fixing ES module outputs...');

  const esmDir = path.join(__dirname, '..', 'dist', 'esm');

  if (!fs.existsSync(esmDir)) {
    console.log('ESM directory not found');
    return;
  }

  let updatedCount = 0;
  let renamedCount = 0;

  function processDirectory(dir) {
    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      if (entry.endsWith('.map')) {
        continue;
      }
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (entry.endsWith('.js') || entry.endsWith('.mjs')) {
        processModuleFile(fullPath);
      }
    }
  }

  function processModuleFile(filePath) {
    const ext = path.extname(filePath);
    const basePath = filePath.slice(0, -ext.length);
    const desiredPath = `${basePath}${TARGET_EXTENSION}`;
    const desiredFileName = path.basename(desiredPath);
    const desiredMapPath = `${desiredPath}.map`;
    const currentMapPath =
      ext === TARGET_EXTENSION ? desiredMapPath : `${filePath}.map`;

    const content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    const ensureExtension = (rawImportPath) => {
      const importPath = rawImportPath.replace(/\\/g, '/');

      if (!importPath.startsWith('.')) {
        return importPath;
      }

      if (importPath.endsWith('.mjs')) {
        return importPath;
      }

      if (importPath.endsWith('.js')) {
        modified = true;
        return `${importPath.slice(0, -3)}.mjs`;
      }

      const sourceDir = path.dirname(filePath);
      const resolvedPath = path.resolve(sourceDir, importPath);

      if (
        fs.existsSync(resolvedPath) &&
        fs.statSync(resolvedPath).isDirectory()
      ) {
        modified = true;
        return `${importPath.replace(/\/$/, '')}/index.mjs`;
      }

      modified = true;
      return `${importPath}.mjs`;
    };

    const updatedContent = content
      .replace(/from\s+['"](\.[^'"]*?)['"];?/g, (match, importPath) => {
        const updatedPath = ensureExtension(importPath);
        return updatedPath === importPath
          ? match
          : match.replace(importPath, updatedPath);
      })
      .replace(
        /import\s*\(\s*['"](\.[^'"]*?)['"](?:\s*,\s*[^)]+)?\s*\)/g,
        (match, importPath) => {
          const updatedPath = ensureExtension(importPath);
          return updatedPath === importPath
            ? match
            : match.replace(importPath, updatedPath);
        }
      );

    let finalContent = updatedContent;
    const desiredMapName = `${desiredFileName}.map`;
    const sourceMapRegex = /\/\/\# sourceMappingURL=([^\s]+)$/m;

    const sourceMapMatch = sourceMapRegex.exec(finalContent);
    if (sourceMapMatch && sourceMapMatch[1] !== desiredMapName) {
      finalContent = finalContent.replace(
        sourceMapRegex,
        `//# sourceMappingURL=${desiredMapName}`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, finalContent, 'utf8');
      updatedCount++;
    }

    if (ext !== TARGET_EXTENSION) {
      fs.renameSync(filePath, desiredPath);
      renamedCount++;
    }

    if (fs.existsSync(currentMapPath)) {
      let mapContent = fs.readFileSync(currentMapPath, 'utf8');
      let mapModified = false;

      if (!mapContent.includes(`"file":"${desiredFileName}"`)) {
        mapContent = mapContent.replace(
          /"file":"([^\"]+)"/,
          `"file":"${desiredFileName}"`
        );
        mapModified = true;
      }

      if (mapModified) {
        fs.writeFileSync(currentMapPath, mapContent, 'utf8');
      }

      if (currentMapPath !== desiredMapPath) {
        fs.renameSync(currentMapPath, desiredMapPath);
      }
    }
  }

  processDirectory(esmDir);

  console.log(
    `ES module outputs fixed successfully! Updated ${updatedCount} files, renamed ${renamedCount} files.`
  );
}

if (require.main === module) {
  try {
    fixESMOutputs();
  } catch (error) {
    console.error('Failed to fix ES module outputs.', error);
    process.exitCode = 1;
  }
}

module.exports = fixESMOutputs;
