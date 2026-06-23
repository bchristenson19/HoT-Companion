// ── HoT Companion — curated colorways ───────────────────────────────────────
// Each colorway re-skins the app by overriding the CSS custom properties from
// theme.css. The actual color values live in theme.css under
// `[data-colorway="<key>"]` selectors; here we just enumerate the choices and a
// 3-swatch preview (bg, accent, text) shown on each switcher button.

export interface Colorway {
  key: string
  name: string
  /** [background, accent, text] preview swatches for the button. */
  swatch: [string, string, string]
}

export const COLORWAYS: Colorway[] = [
  { key: 'omarchy', name: 'Omarchy', swatch: ['#14111a', '#ff7a45', '#ece6f5'] },
  { key: 'gameboy', name: 'Game Boy', swatch: ['#0f380f', '#9bbc0f', '#8bac0f'] },
  { key: 'synthwave', name: 'Synthwave', swatch: ['#1a1033', '#ff2e97', '#4ad7e0'] },
  { key: 'amber', name: 'Amber CRT', swatch: ['#1a1206', '#ffb000', '#ffd040'] },
  { key: 'nord', name: 'Nord', swatch: ['#2e3440', '#88c0d0', '#eceff4'] },
]

export const DEFAULT_COLORWAY = 'omarchy'

export function isColorway(key: string): boolean {
  return COLORWAYS.some((c) => c.key === key)
}
