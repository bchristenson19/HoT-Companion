// ── HoT Companion — icon builder (macOS) ────────────────────────────────────
// Converts resources/icon.png into resources/icon.icns using system `sips` +
// `iconutil`. No-op with a warning on non-macOS.

const { execSync } = require('child_process')
const { existsSync, mkdirSync, rmSync } = require('fs')
const { join } = require('path')

const RES = join(__dirname, '..', 'resources')
const PNG = join(RES, 'icon.png')
const ICNS = join(RES, 'icon.icns')
const ICONSET = join(RES, 'icon.iconset')

if (process.platform !== 'darwin') {
  console.warn('make-icns: skipped (macOS only)')
  process.exit(0)
}
if (!existsSync(PNG)) {
  console.warn(`make-icns: ${PNG} not found — run make-icon.cjs first`)
  process.exit(0)
}

const SIZES = [16, 32, 64, 128, 256, 512]
mkdirSync(ICONSET, { recursive: true })
for (const s of SIZES) {
  execSync(`sips -z ${s} ${s} "${PNG}" --out "${join(ICONSET, `icon_${s}x${s}.png`)}"`)
  execSync(`sips -z ${s * 2} ${s * 2} "${PNG}" --out "${join(ICONSET, `icon_${s}x${s}@2x.png`)}"`)
}
execSync(`iconutil -c icns "${ICONSET}" -o "${ICNS}"`)
rmSync(ICONSET, { recursive: true, force: true })
console.log(`make-icns: wrote ${ICNS}`)
