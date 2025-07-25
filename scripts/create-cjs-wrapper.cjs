// Erstellt dist/index.cjs als CommonJS-Wrapper
const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, '../dist/index.cjs');
fs.writeFileSync(target, "module.exports = require('./index.js');\n");
