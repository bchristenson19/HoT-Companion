// ── HoT Companion — control model accessors ─────────────────────────────────
// Read/write the handful of style fields the grid edits, across the formats
// Companion has shipped:
//   • 3.x "button":         control.style = { text, size, color, bgcolor, ... }
//   • 4.x "button-layered":  control.style.layers = [ { ...text/fill layer } ]
// Every accessor is non-destructive: writers mutate only the targeted field and
// leave all sibling keys (and unknown layers) untouched.

import type { RawControl, EditableField } from '../types'

// ── Color helpers ───────────────────────────────────────────────────────────
// Companion has stored colors as a 24-bit integer, an 'rgb(r,g,b)'/'rgba(...)'
// string, or a '#rrggbb' string depending on version. We display as #rrggbb and
// write back in the SAME representation the field already used, so files from
// any version round-trip cleanly.

type ColorRepr = 'int' | 'rgb' | 'hex' | 'unknown'

function reprOf(value: unknown): ColorRepr {
  if (typeof value === 'number') return 'int'
  if (typeof value === 'string') {
    if (value.startsWith('#')) return 'hex'
    if (value.startsWith('rgb')) return 'rgb'
  }
  return 'unknown'
}

function clamp8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)))
}

function toHex(value: unknown): string {
  if (typeof value === 'number') {
    const r = (value >> 16) & 0xff
    const g = (value >> 8) & 0xff
    const b = value & 0xff
    return rgbToHex(r, g, b)
  }
  if (typeof value === 'string') {
    if (value.startsWith('#')) return value.length === 7 ? value.toLowerCase() : value
    const m = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]))
  }
  return ''
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number): string => clamp8(n).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function hexToParts(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

/** Convert a user-entered #rrggbb back into the representation `existing` used.
 *  Falls back to the hex string if the existing value gives no hint. */
function fromHex(hex: string, existing: unknown): number | string {
  const parts = hexToParts(hex)
  if (!parts) return hex
  switch (reprOf(existing)) {
    case 'int':
      return (parts.r << 16) | (parts.g << 8) | parts.b
    case 'rgb':
      return `rgb(${parts.r}, ${parts.g}, ${parts.b})`
    case 'hex':
    case 'unknown':
    default:
      return hex.toLowerCase()
  }
}

// ── Style object resolution ─────────────────────────────────────────────────
// Returns the object that actually holds the editable style fields, plus the
// concrete key name to use (formats differ on 'color' vs 'fgcolor', etc.).

/** Find the flat style object for a control, or null for layered/none. */
function flatStyle(control: RawControl): RawControl | null {
  const s = control?.style
  if (s && typeof s === 'object' && !Array.isArray(s.layers)) return s as RawControl
  return null
}

/** Find the text-bearing layer in a 4.x layered control, or null. */
function textLayer(control: RawControl): RawControl | null {
  const layers = control?.style?.layers
  if (!Array.isArray(layers)) return null
  // Prefer a layer that already carries a `text` field; else the first layer.
  return (layers.find((l) => l && typeof l === 'object' && 'text' in l) ?? layers[0] ?? null) as
    | RawControl
    | null
}

// ── Field getters ───────────────────────────────────────────────────────────

export function getText(control: RawControl): string {
  const flat = flatStyle(control)
  if (flat && typeof flat.text === 'string') return flat.text
  const layer = textLayer(control)
  if (layer && typeof layer.text === 'string') return layer.text
  return ''
}

export function getSize(control: RawControl): string {
  const src = flatStyle(control) ?? textLayer(control)
  const v = src?.size
  if (v == null) return ''
  return String(v)
}

export function getAlignment(control: RawControl): string {
  const src = flatStyle(control) ?? textLayer(control)
  return typeof src?.alignment === 'string' ? src.alignment : ''
}

export function getColor(control: RawControl): string {
  const src = flatStyle(control) ?? textLayer(control)
  if (!src) return ''
  const raw = 'color' in src ? src.color : src.fgcolor
  return toHex(raw)
}

export function getBgColor(control: RawControl): string {
  const flat = flatStyle(control)
  if (flat) return toHex(flat.bgcolor)
  // Layered: the background is usually a fill layer (no `text`).
  const layers = control?.style?.layers
  if (Array.isArray(layers)) {
    const fill = layers.find((l) => l && typeof l === 'object' && !('text' in l))
    if (fill) return toHex('bgcolor' in fill ? fill.bgcolor : fill.color)
  }
  return ''
}

export function getField(control: RawControl, field: EditableField): string {
  switch (field) {
    case 'text':
      return getText(control)
    case 'bgcolor':
      return getBgColor(control)
    case 'color':
      return getColor(control)
    case 'size':
      return getSize(control)
    case 'alignment':
      return getAlignment(control)
  }
}

// ── Field setters (non-destructive) ─────────────────────────────────────────

function setStyleKey(target: RawControl, key: string, value: unknown): void {
  target[key] = value
}

export function setText(control: RawControl, value: string): void {
  const flat = flatStyle(control)
  if (flat) {
    setStyleKey(flat, 'text', value)
    return
  }
  const layer = textLayer(control)
  if (layer) setStyleKey(layer, 'text', value)
}

export function setSize(control: RawControl, value: string): void {
  const src = flatStyle(control) ?? textLayer(control)
  if (!src) return
  // Preserve numeric typing where the field was numeric.
  const n = Number(value)
  src.size = value !== 'auto' && value !== '' && !Number.isNaN(n) ? n : value
}

export function setAlignment(control: RawControl, value: string): void {
  const src = flatStyle(control) ?? textLayer(control)
  if (src) src.alignment = value
}

export function setColor(control: RawControl, value: string): void {
  const src = flatStyle(control) ?? textLayer(control)
  if (!src) return
  const key = 'color' in src || !('fgcolor' in src) ? 'color' : 'fgcolor'
  src[key] = fromHex(value, src[key])
}

export function setBgColor(control: RawControl, value: string): void {
  const flat = flatStyle(control)
  if (flat) {
    flat.bgcolor = fromHex(value, flat.bgcolor)
    return
  }
  const layers = control?.style?.layers
  if (Array.isArray(layers)) {
    const fill = layers.find((l) => l && typeof l === 'object' && !('text' in l))
    if (fill) {
      const key = 'bgcolor' in fill ? 'bgcolor' : 'color'
      fill[key] = fromHex(value, fill[key])
    }
  }
}

export function setField(control: RawControl, field: EditableField, value: string): void {
  switch (field) {
    case 'text':
      return setText(control, value)
    case 'bgcolor':
      return setBgColor(control, value)
    case 'color':
      return setColor(control, value)
    case 'size':
      return setSize(control, value)
    case 'alignment':
      return setAlignment(control, value)
  }
}

// ── Steps / actions / feedbacks summaries ───────────────────────────────────

/** Normalize the `steps` container (object keyed by step id, or array) into an
 *  ordered list of step objects. */
export function stepList(control: RawControl): RawControl[] {
  return stepEntries(control).map((e) => e.step)
}

/** Like {@link stepList} but keeps each step's id (the key in the steps object,
 *  or the stringified array index). Order is by numeric id. */
export function stepEntries(control: RawControl): { stepId: string; step: RawControl }[] {
  const steps = control?.steps
  if (!steps) return []
  if (Array.isArray(steps)) {
    return steps
      .map((step, i) => ({ stepId: String(i), step }))
      .filter((e) => e.step)
  }
  if (typeof steps === 'object') {
    return Object.keys(steps)
      .sort((a, b) => Number(a) - Number(b))
      .map((stepId) => ({ stepId, step: steps[stepId] }))
      .filter((e) => e.step)
  }
  return []
}

export function stepCount(control: RawControl): number {
  return stepList(control).length
}

/** All actions across all steps and action sets, flattened. */
function allActions(control: RawControl): RawControl[] {
  const out: RawControl[] = []
  for (const step of stepList(control)) {
    const sets = step?.action_sets
    if (!sets || typeof sets !== 'object') continue
    for (const key of Object.keys(sets)) {
      const arr = sets[key]
      if (Array.isArray(arr)) out.push(...arr.filter(Boolean))
    }
  }
  return out
}

export function allFeedbacks(control: RawControl): RawControl[] {
  const fb = control?.feedbacks
  return Array.isArray(fb) ? fb.filter(Boolean) : []
}

/** The connectionId an action/feedback entity targets (key differs by version:
 *  `connectionId` in 4.x, `instance` / `instance_id` in 3.x). */
export function entityConnectionId(entity: RawControl): string | null {
  for (const k of ['connectionId', 'instance', 'instance_id']) {
    const v = entity?.[k]
    if (typeof v === 'string' && v) return v
  }
  return null
}

/** The action/feedback type id (key differs by version). */
function entityTypeId(entity: RawControl): string {
  for (const k of ['actionId', 'action', 'feedbackId', 'type']) {
    const v = entity?.[k]
    if (typeof v === 'string' && v) return v
  }
  return '?'
}

export function actionSummaries(control: RawControl): string[] {
  return allActions(control).map((a) => entityTypeId(a))
}

export function feedbackSummaries(control: RawControl): string[] {
  return allFeedbacks(control).map((f) => entityTypeId(f))
}

/** Every distinct connectionId referenced by this control's actions+feedbacks. */
export function controlConnectionIds(control: RawControl): string[] {
  const ids = new Set<string>()
  for (const a of allActions(control)) {
    const id = entityConnectionId(a)
    if (id) ids.add(id)
  }
  for (const f of allFeedbacks(control)) {
    const id = entityConnectionId(f)
    if (id) ids.add(id)
  }
  return [...ids]
}
