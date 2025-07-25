#!/usr/bin/env node

/**
 * Simple test script to verify package functionality
 * This can be run in CI without browser dependencies
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing package functionality...');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    console.error('❌ dist folder not found!');
    process.exit(1);
}

// Check for main files
const requiredFiles = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/esm/index.js',
    'dist/browser.js',
    'dist/node.js'
];

let allFilesExist = true;
for (const file of requiredFiles) {
    const filePath = path.join(__dirname, file);
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Required file missing: ${file}`);
        allFilesExist = false;
    } else {
        console.log(`✅ Found: ${file}`);
    }
}

if (!allFilesExist) {
    process.exit(1);
}

// Try to require the main module
try {
    const main = require('./dist/index.js');
    console.log('✅ Main module loads successfully');
    console.log('📦 Package test completed successfully!');
} catch (error) {
    console.error('❌ Failed to require main module:', error.message);
    process.exit(1);
}
