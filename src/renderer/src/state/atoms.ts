// ── HoT Companion — Jotai state ─────────────────────────────────────────────
// The renderer holds the raw config object (round-trip source of truth) plus a
// flattened, editable row view. Edits mutate the raw object in place and then
// re-derive the affected rows so the grid stays in sync without a full reload.

import { atom } from 'jotai'
import type {
  LoadedConfig,
  ButtonRow,
  ButtonTemplate,
  EditableField,
} from '@shared/types'
import { DEFAULT_COLORWAY, isColorway } from '../lib/colorways'

export type Tab = 'buttons' | 'replace' | 'templates'

export const tabAtom = atom<Tab>('buttons')

// ── Colorway (persisted to localStorage, applied to <html data-colorway>) ────
const COLORWAY_KEY = 'hot-companion:colorway'

function readColorway(): string {
  try {
    const v = localStorage.getItem(COLORWAY_KEY)
    if (v && isColorway(v)) return v
  } catch {
    /* ignore */
  }
  return DEFAULT_COLORWAY
}

const colorwayBaseAtom = atom<string>(readColorway())

/** Active colorway. Writing it persists to localStorage; the App effect mirrors
 *  it onto <html data-colorway> so the CSS overrides in theme.css take effect. */
export const colorwayAtom = atom(
  (get) => get(colorwayBaseAtom),
  (_get, set, value: string) => {
    set(colorwayBaseAtom, value)
    try {
      localStorage.setItem(COLORWAY_KEY, value)
    } catch {
      /* ignore persistence failures */
    }
  },
)

// ── Loaded document ─────────────────────────────────────────────────────────
export const loadedAtom = atom<LoadedConfig | null>(null)
export const rowsAtom = atom<ButtonRow[]>([])
export const dirtyAtom = atom<boolean>(false)

/** True once a file is open. */
export const hasConfigAtom = atom((get) => get(loadedAtom) !== null)

// ── Grid selection ──────────────────────────────────────────────────────────
// Selection is a set of row ids; the "anchor" supports shift-range selection.
export const selectedIdsAtom = atom<Set<string>>(new Set<string>())
export const anchorIdAtom = atom<string | null>(null)

/** Which page to show in the grid; '' = all pages. */
export const pageFilterAtom = atom<string>('')
/** Free-text filter over label/type/connection. */
export const textFilterAtom = atom<string>('')

// ── Templates ───────────────────────────────────────────────────────────────
export const templatesAtom = atom<ButtonTemplate[]>([])

// ── Button detail panel ───────────────────────────────────────────────────
/** Whether the details side panel is shown in the Buttons tab. */
export const detailOpenAtom = atom<boolean>(true)

/** Bumped after every in-place detail mutation so the panel re-renders the
 *  freshly-mutated raw config (which is edited by reference, not replaced). */
export const detailTickAtom = atom<number>(0)

/** The button to inspect: the lone selected row, else the selection anchor.
 *  null when nothing usable is selected. */
export const detailTargetAtom = atom((get) => {
  const sel = get(selectedIdsAtom)
  const rows = get(rowsAtom)
  let id: string | null = null
  if (sel.size === 1) id = [...sel][0]
  else if (sel.size > 1) {
    const anchor = get(anchorIdAtom)
    id = anchor && sel.has(anchor) ? anchor : null
  }
  if (!id) return null
  return rows.find((r) => r.id === id) ?? null
})

// ── Derived: rows after filters ─────────────────────────────────────────────
export const visibleRowsAtom = atom((get) => {
  const rows = get(rowsAtom)
  const page = get(pageFilterAtom)
  const q = get(textFilterAtom).trim().toLowerCase()
  return rows.filter((r) => {
    if (page && String(r.loc.page) !== page) return false
    if (!q) return true
    const hay = `${r.text} ${r.type} ${r.connectionIds.join(' ')} ${r.loc.pageName}`.toLowerCase()
    return hay.includes(q)
  })
})

/** Distinct page numbers present, for the page filter dropdown. */
export const pagesAtom = atom((get) => {
  const seen = new Map<number, string>()
  for (const r of get(rowsAtom)) if (!seen.has(r.loc.page)) seen.set(r.loc.page, r.loc.pageName)
  return [...seen.entries()].sort((a, b) => a[0] - b[0]).map(([num, name]) => ({ num, name }))
})

// ── Edit descriptor (consumed by the actions hook) ──────────────────────────
export interface PendingEdit {
  ids: string[]
  field: EditableField
  value: string
}
