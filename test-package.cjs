const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function resolveThreadCtor(mod) {
  if (!mod || typeof mod !== 'object') {
    return undefined;
  }

  if (typeof mod.ThreadTS === 'function') {
    return mod.ThreadTS;
  }

  if (typeof mod.ThreadJS === 'function') {
    return mod.ThreadJS;
  }

  const defaultExport = mod.default;
  if (defaultExport && typeof defaultExport === 'object') {
    if (typeof defaultExport.ThreadTS === 'function') {
      return defaultExport.ThreadTS;
    }
    if (typeof defaultExport.ThreadJS === 'function') {
      return defaultExport.ThreadJS;
    }
  }

  return undefined;
}

function resolveThreadInstance(mod) {
  if (!mod || typeof mod !== 'object') {
    return undefined;
  }

  if (mod.threadts && typeof mod.threadts.run === 'function') {
    return mod.threadts;
  }

  if (mod.threadjs && typeof mod.threadjs.run === 'function') {
    return mod.threadjs;
  }

  const defaultExport = mod.default;
  if (defaultExport && typeof defaultExport.run === 'function') {
    return defaultExport;
  }

  return undefined;
}

function listDirRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listDirRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

async function run() {
  const root = __dirname;
  const distDir = path.join(root, 'dist');
  const esmDir = path.join(distDir, 'esm');
  const pkgPath = path.join(root, 'package.json');

  assert(fs.existsSync(pkgPath), 'package.json is missing');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  const expectedPaths = {
    main: path.join(root, pkg.main || ''),
    module: path.join(root, pkg.module || ''),
    types: path.join(root, pkg.types || ''),
    exportImport: path.join(root, pkg.exports?.['.']?.import || ''),
    exportRequire: path.join(root, pkg.exports?.['.']?.require || ''),
    exportTypes: path.join(root, pkg.exports?.['.']?.types || ''),
  };

  for (const [key, filePath] of Object.entries(expectedPaths)) {
    assert(
      filePath && fs.existsSync(filePath),
      `Expected ${key} file missing: ${path.relative(root, filePath)}`
    );
    const stats = fs.statSync(filePath);
    assert(
      stats.size > 0,
      `Expected ${key} file empty: ${path.relative(root, filePath)}`
    );
  }

  assert(Array.isArray(pkg.files), 'package.json files field must be an array');
  assert(
    pkg.files.includes('dist/**/*'),
    'package.json files field must include dist/**/*'
  );
  assert(
    pkg.files.includes('src/**/*'),
    'package.json files field must include src/**/*'
  );

  assert(fs.existsSync(distDir), 'dist directory missing');
  assert(fs.existsSync(esmDir), 'dist/esm directory missing');

  const esmFiles = listDirRecursive(esmDir).filter(
    (file) => !file.endsWith('.map')
  );
  const invalidEsmFiles = esmFiles.filter(
    (file) => !(file.endsWith('.mjs') || file.endsWith('.d.ts'))
  );
  assert(
    invalidEsmFiles.length === 0,
    `ESM output contains unexpected extensions: ${invalidEsmFiles.map((file) => path.relative(root, file)).join(', ')}`
  );

  let esmModule;
  try {
    esmModule = await import(pathToFileURL(expectedPaths.exportImport).href);
  } catch (error) {
    throw new Error(`Failed to import ESM entry: ${error.message}`);
  }

  const esmThreadCtor = resolveThreadCtor(esmModule);
  assert(
    typeof esmThreadCtor === 'function',
    'ESM exports do not expose a thread constructor'
  );
  assert(
    typeof esmThreadCtor.getInstance === 'function',
    'ESM thread constructor does not expose getInstance'
  );
  const esmThreadInstance = resolveThreadInstance(esmModule);
  assert(
    esmThreadInstance,
    'ESM default export does not expose a runnable instance'
  );

  let cjsModule;
  try {
    cjsModule = require(expectedPaths.exportRequire);
  } catch (error) {
    throw new Error(`Failed to require CJS entry: ${error.message}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 10));

  const cjsThreadCtor = resolveThreadCtor(cjsModule);
  assert(
    typeof cjsThreadCtor === 'function',
    'CJS exports do not expose a thread constructor'
  );
  assert(
    typeof cjsThreadCtor.getInstance === 'function',
    'CJS thread constructor does not expose getInstance'
  );
  const cjsThreadInstance = resolveThreadInstance(cjsModule);
  assert(
    cjsThreadInstance,
    'CJS default export does not expose a runnable instance'
  );

  console.log('✅ Package structure validated successfully');
}

run().catch((error) => {
  console.error('❌ Package validation failed');
  console.error(error);
  process.exit(1);
});
