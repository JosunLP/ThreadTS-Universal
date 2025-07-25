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

module.exports = new Proxy({}, {
  get: function(_, prop) {
    if (!esmExports) {
      esmExports = mod.createRequire(__filename)(esmPath);
      esmDefault = esmExports.default || esmExports.ThreadTS || esmExports.threadts;
    }
    if (prop === 'default') return esmDefault;
    return esmExports[prop];
  },
  ownKeys: function() {
    if (!esmExports) {
      esmExports = mod.createRequire(__filename)(esmPath);
    }
    return Reflect.ownKeys(esmExports);
  },
  getOwnPropertyDescriptor: function(_, prop) {
    return { enumerable: true, configurable: true };
  }
});
`;
fs.writeFileSync(target, wrapper);
