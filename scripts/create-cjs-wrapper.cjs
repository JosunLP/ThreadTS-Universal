// Erstellt dist/index.cjs als CommonJS-Wrapper
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../dist/index.cjs');
const wrapper = `
const path = require('path');
const { pathToFileURL } = require('url');
const esmPath = pathToFileURL(path.join(__dirname, 'esm', 'index.js')).href;
let esmExports = null;
let esmDefault = null;
let esmPromise = null;

function loadExportsSync() {
  if (!esmPromise) {
    esmPromise = import(esmPath).then((mod) => {
      esmExports = mod;
      esmDefault = mod.default || mod.ThreadTS || mod.threadts;
    });
  }
}

const proxy = new Proxy(
  {},
  {
    get: function (_, prop) {
      if (!esmExports) {
        throw new Error(
          "Das ESM-Modul ist noch nicht geladen. Greife asynchron auf die Exporte zu, z.B. via import('threadts-universal')."
        );
      }
      if (prop === 'default') return esmDefault;
      return esmExports[prop];
    },
    ownKeys: function () {
      if (!esmExports) return [];
      return Reflect.ownKeys(esmExports);
    },
    getOwnPropertyDescriptor: function (_, prop) {
      return { enumerable: true, configurable: true };
    },
  }
);

module.exports = proxy;
loadExportsSync();
`;
fs.writeFileSync(target, wrapper);
