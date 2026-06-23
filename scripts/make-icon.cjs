// ── HoT Companion — app icon generator ──────────────────────────────────────
// Bakes resources/icon.png from the shared pixel-art definition in
// src/renderer/src/lib/iconArt.mjs (the same module the in-app logo and the live
// Dock icon use, so all three render identically). The baked icon uses the
// default Omarchy palette; the app recolors live per the user's colorway.
// Borrows the `canvas` module from the sibling hot-atem app (not a dep here).
//
// Usage: node scripts/make-icon.cjs [colorwayKey] [outPath]
//   defaults: omarchy → resources/icon.png

const { existsSync, writeFileSync, mkdirSync } = require('fs')
const { join } = require('path')

let createCanvas
for (const p of [
  join(__dirname, '../node_modules/canvas'),
  join(__dirname, '../../hot-atem/node_modules/canvas'),
]) {
  if (existsSync(p)) {
    ;({ createCanvas } = require(p))
    break
  }
}
if (!createCanvas) {
  console.error('make-icon: canvas module not found (tried local + ../hot-atem). Skipping.')
  process.exit(0)
}

async function main() {
  const { drawIcon, PALETTES } = await import('../src/renderer/src/lib/iconArt.mjs')
  const key = process.argv[2] || 'omarchy'
  const palette = PALETTES[key] || PALETTES.omarchy
  const out = process.argv[3] || join(__dirname, '..', 'resources', 'icon.png')

  const S = 1024
  const canvas = createCanvas(S, S)
  const ctx = canvas.getContext('2d')
  drawIcon(ctx, S, palette)

  mkdirSync(join(out, '..'), { recursive: true })
  writeFileSync(out, canvas.toBuffer('image/png'))
  console.log(`make-icon: wrote ${out} (${key})`)
}

main().catch((e) => {
  console.error('make-icon failed:', e)
  process.exit(1)
})
