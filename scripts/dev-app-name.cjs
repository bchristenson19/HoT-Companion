#!/usr/bin/env node
// ── Dev/preview app-name fix ────────────────────────────────────────────────
// In `npm run dev` / `npm start` the app runs inside node_modules' generic
// Electron.app bundle, whose Info.plist CFBundleName is "Electron". macOS reads
// the Dock tooltip from that plist before any JS runs, so app.setName() can't
// change it in dev. This patches the dev bundle's plist to our product name.
//
// Packaged builds are unaffected — electron-builder stamps productName from
// electron-builder.yml. This only touches the throwaway dev bundle and is
// idempotent (safe to re-run after npm reinstalls Electron).

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PRODUCT_NAME = 'HoT Companion'

// macOS only — Windows/Linux dev runs don't have this Info.plist / Dock concept.
if (process.platform !== 'darwin') process.exit(0)

const plist = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron',
  'dist',
  'Electron.app',
  'Contents',
  'Info.plist',
)

if (!fs.existsSync(plist)) {
  // Electron not installed yet (e.g. running before npm install finished).
  process.exit(0)
}

const set = (key, value) => {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist])
  } catch {
    // Key missing — add it. (CFBundleName/DisplayName always exist, but be safe.)
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist])
  }
}

set('CFBundleName', PRODUCT_NAME)
set('CFBundleDisplayName', PRODUCT_NAME)

console.log(`dev-app-name: set Electron bundle name → "${PRODUCT_NAME}"`)
