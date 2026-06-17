// ── HoT Companion — emoji glyphs & friendly labels ──────────────────────────
// Tiny emoji-as-pixel-icon set for sight-recognition across the UI. Emoji
// render as crisp blocky glyphs at small sizes and need no font download
// (the renderer CSP blocks web fonts). Modeled on hot-kumo's glyphs.ts.

/** Icon map — reference as ICON.buttons, ICON.save, etc. */
export const ICON = {
  // Tabs
  buttons: '🎛️',
  replace: '🔍',
  templates: '📋',

  // File actions
  open: '📂',
  save: '💾',
  saveAs: '📤',
  dirty: '●',

  // Grid columns / button properties
  location: '📍',
  kind: '🔖',
  text: '🔤',
  bg: '🎨',
  fg: '✏️',
  size: '🔠',
  align: '↔️',
  actions: '⚡',
  feedbacks: '🚦',
  page: '📄',

  // States / help
  tip: 'ℹ️',
  select: '☑️',
  stamp: '🔖',
  capture: '📸',
  trash: '🗑️',

  // Detail panel
  details: '👁️',
  step: '👣',
  addItem: '➕',
  up: '⬆️',
  down: '⬇️',
  dup: '⧉',
  connection: '🔌',
  delay: '⏱️',
  raw: '{}',
} as const

/** Friendly names for the control `type` field shown in the "Kind" column. */
const TYPE_NAMES: Record<string, string> = {
  button: 'Button',
  'button-layered': 'Button',
  pageup: 'Page up',
  pagedown: 'Page down',
  pagenum: 'Page number',
}

/** Map a raw control type to a plain-English word (falls back to the raw id). */
export function friendlyType(type: string): string {
  if (!type) return '—'
  return TYPE_NAMES[type] ?? type
}
