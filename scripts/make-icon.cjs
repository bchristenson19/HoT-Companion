// ── HoT Companion — app icon generator ──────────────────────────────────────
// Scales resources/AppIcon-source.png → resources/icon.png at 1024×1024.
// Then run make-icns.cjs to regenerate icon.icns.
//
// Usage: node scripts/make-icon.cjs [outPath]
//   defaults: resources/AppIcon-source.png → resources/icon.png

const { execSync } = require('child_process')
const { existsSync } = require('fs')
const { join } = require('path')

const SRC = join(__dirname, '..', 'resources', 'AppIcon-source.png')
const OUT = process.argv[2] || join(__dirname, '..', 'resources', 'icon.png')

if (!existsSync(SRC)) {
  console.error(`make-icon: source not found: ${SRC}`)
  process.exit(1)
}

execSync(`sips -z 1024 1024 "${SRC}" --out "${OUT}"`, { stdio: 'inherit' })
console.log(`make-icon: wrote ${OUT}`)
