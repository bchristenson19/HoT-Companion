// ── HoT Companion — app icon generator ──────────────────────────────────────
// Draws a pixel-art "button bank" icon (a Stream Deck-style 4×4 grid with a few
// lit keys) in the Omarchy-inspired palette → resources/icon.png. Borrows the
// `canvas` module from the sibling hot-atem app (not a dep of this app).

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

const S = 1024
const canvas = createCanvas(S, S)
const c = canvas.getContext('2d')

const BG = '#14111a'
const BG2 = '#0d0b12'
const CELL = '#241d31'
const CELL_HI = '#3a3147'
const ACCENT = '#ff7a45'
const ACCENT_HI = '#ff9d6e'
const GREEN = '#5ddf7a'
const CYAN = '#4ad7e0'

function rr(x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

// Background tile.
c.fillStyle = BG2
rr(0, 0, S, S, 180)
c.fill()
c.fillStyle = BG
rr(40, 40, S - 80, S - 80, 150)
c.fill()

// 4×4 button bank — a few keys lit to suggest bulk programming.
const N = 4
const margin = 150
const gap = 36
const span = S - margin * 2
const cell = (span - gap * (N - 1)) / N

// Lit map: accent (being-edited), green (live), cyan (selected).
const lit = {
  '0,0': ACCENT,
  '0,1': ACCENT,
  '0,2': ACCENT,
  '1,0': CYAN,
  '2,3': GREEN,
  '3,1': GREEN,
}

for (let row = 0; row < N; row++) {
  for (let col = 0; col < N; col++) {
    const x = margin + col * (cell + gap)
    const y = margin + row * (cell + gap)
    const color = lit[`${row},${col}`]
    if (color) {
      c.fillStyle = color
      rr(x, y, cell, cell, 12)
      c.fill()
      // inner pixel notch
      c.fillStyle = BG2
      const d = cell * 0.3
      c.fillRect(x + (cell - d) / 2, y + (cell - d) / 2, d, d)
    } else {
      c.fillStyle = CELL
      rr(x, y, cell, cell, 12)
      c.fill()
      c.fillStyle = CELL_HI
      c.fillRect(x, y, cell, 8)
    }
  }
}

// Accent frame + corner ticks.
c.lineWidth = 14
c.strokeStyle = ACCENT
rr(40, 40, S - 80, S - 80, 150)
c.stroke()
c.fillStyle = ACCENT_HI
for (const [px, py] of [
  [70, 70],
  [S - 110, 70],
  [70, S - 110],
  [S - 110, S - 110],
]) {
  c.fillRect(px, py, 40, 40)
}

const RES = join(__dirname, '..', 'resources')
mkdirSync(RES, { recursive: true })
const out = join(RES, 'icon.png')
writeFileSync(out, canvas.toBuffer('image/png'))
console.log('make-icon: wrote', out)
