// Erstellt dist/index.cjs als CommonJS-Wrapper
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../dist/index.cjs');
const wrapper = `
const mod = require('module');
const path = require('path');
const esmPath = path.join(__dirname, 'index.js');
let esmExports;
let esmDefault;

function loadExports() {
  if (!esmExports) {
    esmExports = mod.createRequire(__filename)(esmPath);
    esmDefault = esmExports.default || esmExports.ThreadTS || esmExports.threadts;
  }
}

Object.defineProperty(module, 'exports', {
  enumerable: true,
  configurable: true,
  get: function() {
    loadExports();
    const proxy = new Proxy({}, {
      get: function(_, prop) {
        if (prop === 'default') return esmDefault;
        return esmExports[prop];
      },
      ownKeys: function() {
        return Reflect.ownKeys(esmExports);
      },
      getOwnPropertyDescriptor: function(_, prop) {
        return { enumerable: true, configurable: true };
      }
    });
    return proxy;
  }
});
`;
fs.writeFileSync(target, wrapper);
