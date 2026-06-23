// ── HoT Companion — shared icon art ─────────────────────────────────────────
// One source of truth for the app icon, drawn as pixel-art so it matches the
// HoT suite (chunky square "pixels", like hot-buddy / hot-kumo). Used by THREE
// callers, all via drawIcon():
//   • scripts/make-icon.cjs  — bakes resources/icon.png at build time (node-canvas)
//   • components/PepperMark   — the in-app topbar logo (browser canvas, live)
//   • App dock-icon effect    — pushes a recolored icon to the macOS Dock
// Plain .mjs (no TS) so the Node build script can `await import()` it and Vite
// can import it too — identical rendering everywhere.
//
// The motif: a pixel chili pepper (the "source") on the left with a bent green
// stem, and a blocky routing fan stepping out to a column of square destination
// "ports" on the right — the app's bulk-distribute idea in the pepper theme.

// 24×24 pixel grid. Legend (each char → a ROLE, not a literal color):
//   .  transparent (shows the dark tile)
//   X  pepper outline / dark edge
//   B  pepper body (accent)
//   S  pepper shade (accent-dim, lower/right for form)
//   H  pepper highlight (accent-bright specular)
//   G  stem (green)
//   o  origin node (accent, where the fan starts)
//   L  routing line (text color)
//   D  destination port block (text color)
//   c  destination port core (dark, knocked out of D)
export const PEPPER = [
  '........................',
  '.........GGG............',
  '.......GGG..............',
  '.....XXXGX..........DDD.',
  '....XXBBSX.........LDcD.',
  '....XBHBSX........L.DDD.',
  '....XHHBSX.......L......',
  '....XBBBSXX.....L.......',
  '....XBBBBSX.....L...DDD.',
  '....XXBBBSX....L..LLDcD.',
  '.....XBBBSXX..LLLL..DDD.',
  '.....XXBBBSXoLL.........',
  '......XBBBSXX.LLL.......',
  '......XXBBBSX.L..LL.DDD.',
  '.......XBBBSXX.L...LDcD.',
  '.......XXBBBSX..L...DDD.',
  '........XBBBSXX..L......',
  '........XXBBBSXX.L......',
  '.........XXBBBSXX.L.DDD.',
  '..........XXBBBSXX.LDcD.',
  '...........XXXBBSX..DDD.',
  '.............XXXXX......',
  '........................',
  '........................',
]

// Role → token name. PALETTES below resolve token names to hex per colorway.
const ROLE = {
  X: 'outline',
  B: 'body',
  S: 'bodyShade',
  H: 'highlight',
  G: 'stem',
  o: 'origin',
  L: 'line',
  D: 'dot',
  c: 'dotCore',
}

// Per-colorway palettes. Token values mirror styles/theme.css so the icon
// matches the live UI for each colorway. (Drawing is independent of CSS so the
// build-time bake and the runtime canvas render identically.)
export const PALETTES = {
  omarchy: {
    bg: '#14111a', bgInner: '#1d1826', frame: '#ff7a45', tick: '#ff9d6e',
    outline: '#0d0b12', body: '#ff7a45', bodyShade: '#6e3115', highlight: '#ff9d6e',
    stem: '#5ddf7a', origin: '#ff9d6e', line: '#ece6f5', dot: '#ece6f5', dotCore: '#0d0b12',
  },
  gameboy: {
    bg: '#0f380f', bgInner: '#163d16', frame: '#9bbc0f', tick: '#c4d62a',
    outline: '#081c08', body: '#9bbc0f', bodyShade: '#306230', highlight: '#c4d62a',
    stem: '#c4d62a', origin: '#c4d62a', line: '#0f380f', dot: '#9bbc0f', dotCore: '#081c08',
  },
  synthwave: {
    bg: '#1a1033', bgInner: '#241546', frame: '#ff2e97', tick: '#ff6ec0',
    outline: '#0e0820', body: '#ff2e97', bodyShade: '#7a0f49', highlight: '#ff6ec0',
    stem: '#4ad7e0', origin: '#4ad7e0', line: '#f3e9ff', dot: '#4ad7e0', dotCore: '#0e0820',
  },
  amber: {
    bg: '#1a1206', bgInner: '#241a09', frame: '#ffb000', tick: '#ffd040',
    outline: '#0d0903', body: '#ffb000', bodyShade: '#6e4a00', highlight: '#ffd040',
    stem: '#d0c020', origin: '#ffd040', line: '#ffd040', dot: '#ffd040', dotCore: '#0d0903',
  },
  nord: {
    bg: '#2e3440', bgInner: '#3b4252', frame: '#88c0d0', tick: '#8fbcbb',
    outline: '#242933', body: '#88c0d0', bodyShade: '#3b5560', highlight: '#8fbcbb',
    stem: '#a3be8c', origin: '#a3be8c', line: '#eceff4', dot: '#eceff4', dotCore: '#242933',
  },
}

/** Rounded rectangle path on a 2D context. */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draw the full app icon to a 2D canvas context.
 * @param ctx     CanvasRenderingContext2D (node-canvas or browser)
 * @param size    pixel size (square)
 * @param palette one of PALETTES[*]
 */
export function drawIcon(ctx, size, palette) {
  const p = palette
  const S = size
  // Geometry scaled from the 1024 reference design.
  const u = S / 1024
  const radOuter = 180 * u
  const radInner = 150 * u
  const inset = 40 * u

  // Dark rounded tile.
  ctx.fillStyle = p.outline
  rr(ctx, 0, 0, S, S, radOuter)
  ctx.fill()
  ctx.fillStyle = p.bg
  rr(ctx, inset, inset, S - inset * 2, S - inset * 2, radInner)
  ctx.fill()
  // Slightly lighter inner panel for depth (subtle).
  ctx.fillStyle = p.bgInner
  rr(ctx, inset, inset, S - inset * 2, S - inset * 2, radInner)
  ctx.globalAlpha = 0.35
  ctx.fill()
  ctx.globalAlpha = 1

  // Pixel grid. Leave a margin inside the frame.
  const N = PEPPER.length // 24
  const margin = 150 * u
  const span = S - margin * 2
  const cell = span / N

  // Snap to integers for crisp pixel edges; overdraw by ~1px to avoid seams.
  for (let row = 0; row < N; row++) {
    const line = PEPPER[row]
    for (let col = 0; col < line.length; col++) {
      const ch = line[col]
      const role = ROLE[ch]
      if (!role) continue
      const color = p[role]
      if (!color) continue
      const x = Math.round(margin + col * cell)
      const y = Math.round(margin + row * cell)
      const w = Math.ceil(cell) + 1
      const h = Math.ceil(cell) + 1
      ctx.fillStyle = color
      ctx.fillRect(x, y, w, h)
    }
  }

  // Orange frame + corner ticks (HoT brand wrapper).
  ctx.lineWidth = 14 * u
  ctx.strokeStyle = p.frame
  rr(ctx, inset, inset, S - inset * 2, S - inset * 2, radInner)
  ctx.stroke()
  ctx.fillStyle = p.tick
  const t = 40 * u
  const off = 30 * u
  for (const [px, py] of [
    [inset - off + 30 * u, inset - off + 30 * u],
    [S - inset - t - 30 * u + off, inset - off + 30 * u],
    [inset - off + 30 * u, S - inset - t - 30 * u + off],
    [S - inset - t - 30 * u + off, S - inset - t - 30 * u + off],
  ]) {
    ctx.fillRect(px, py, t, t)
  }
}
