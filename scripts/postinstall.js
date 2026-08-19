#!/usr/bin/env node
/**
 * scripts/postinstall.js
 * Copies the prebuilt better-sqlite3 binary to:
 *   1. node_modules/better-sqlite3/build/Release/  (for standard Node)
 *   2. build/Release/                               (for Electron dev mode via npx electron .)
 *
 * Why: vite-plugin-electron bundles dist-electron/main.js and resolves
 * the better-sqlite3 native binding relative to __dirname/../build/Release/
 * which points to <project-root>/build/Release/.
 */
const fs = require('fs');
const path = require('path');

const platform = process.platform; // win32, linux, darwin
const arch = process.arch;         // x64, arm64

// Determine the prebuilt filename
let prebuiltName = `${platform}-${arch}.node`;
// Handle Alpine Linux (musl)
if (platform === 'linux') {
  try {
    const report = process.report && process.report.getReport && process.report.getReport();
    if (report && !report.header.glibcVersionRuntime) {
      prebuiltName = `linuxmusl-${arch}.node`;
    }
  } catch {}
}

const root = path.resolve(__dirname, '..');
const srcFile = path.join(root, 'node_modules', 'better-sqlite3', 'prebuilds', prebuiltName);

if (!fs.existsSync(srcFile)) {
  console.warn(`[postinstall] Warning: prebuilt binary not found at ${srcFile}`);
  console.warn('[postinstall] You may need to run: npx @electron/rebuild');
  process.exit(0);
}

// Destination 1: node_modules/better-sqlite3/build/Release/
const dest1Dir = path.join(root, 'node_modules', 'better-sqlite3', 'build', 'Release');
fs.mkdirSync(dest1Dir, { recursive: true });
fs.copyFileSync(srcFile, path.join(dest1Dir, 'better_sqlite3.node'));

// Destination 2: <project-root>/build/Release/  (required for Electron dev mode)
const dest2Dir = path.join(root, 'build', 'Release');
fs.mkdirSync(dest2Dir, { recursive: true });
fs.copyFileSync(srcFile, path.join(dest2Dir, 'better_sqlite3.node'));

console.log(`[postinstall] ✅ Copied ${prebuiltName} -> build/Release/better_sqlite3.node (2 locations)`);
