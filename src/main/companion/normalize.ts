// ── HoT Companion — normalize / project / mutate ────────────────────────────
// Pure functions (no node/electron deps) so they run in BOTH the main process
// (to build the initial view on load) and the renderer (to apply edits to its
// own copy of the raw config before saving). Controls are always located by
// ControlLocation — never by object pointer — so everything survives the
// structured-clone that happens when the raw config crosses the IPC boundary.

import type {
  RawConfig,
  RawControl,
  ButtonRow,
  ControlLocation,
  ConfigMeta,
  EditableField,
  ReplaceQuery,
  ReplaceMatch,
  ButtonTemplate,
} from '../types'
import {
  getField,
  setField,
  getText,
  getBgColor,
  getColor,
  getSize,
  getAlignment,
  stepCount,
  actionSummaries,
  feedbackSummaries,
  controlConnectionIds,
  allFeedbacks,
} from './model'

// ── Page / control traversal ────────────────────────────────────────────────

/** The `pages` map: { [pageNum]: { name, controls: { [row]: { [col]: ctrl } } } } */
function pagesOf(raw: RawConfig): Record<string, any> {
  const p = raw?.pages
  return p && typeof p === 'object' ? p : {}
}

function pageNumsSorted(raw: RawConfig): string[] {
  return Object.keys(pagesOf(raw)).sort((a, b) => Number(a) - Number(b))
}

/** Resolve the raw control object at a location, or null if the slot is empty.
 *  This is the single point of truth for "where does this row live". */
export function controlAt(raw: RawConfig, loc: ControlLocation): RawControl | null {
  const page = pagesOf(raw)[String(loc.page)]
  const controls = page?.controls
  const row = controls?.[String(loc.row)]
  const ctrl = row?.[String(loc.column)]
  return ctrl && typeof ctrl === 'object' ? (ctrl as RawControl) : null
}

/** Replace the control object at a location (used by template stamping). */
export function setControlAt(raw: RawConfig, loc: ControlLocation, control: RawControl): void {
  const page = pagesOf(raw)[String(loc.page)]
  if (!page) return
  if (!page.controls || typeof page.controls !== 'object') page.controls = {}
  const r = String(loc.row)
  if (!page.controls[r] || typeof page.controls[r] !== 'object') page.controls[r] = {}
  page.controls[r][String(loc.column)] = control
}

function controlType(control: RawControl): string {
  return typeof control?.type === 'string' ? control.type : ''
}

// ── Connection labels ───────────────────────────────────────────────────────

/** connectionId -> label, from the export's `instances` map. */
export function connectionLabels(raw: RawConfig): Record<string, string> {
  const out: Record<string, string> = {}
  const inst = raw?.instances
  if (inst && typeof inst === 'object') {
    for (const id of Object.keys(inst)) {
      const entry = inst[id]
      if (entry && typeof entry === 'object' && typeof entry.label === 'string') {
        out[id] = entry.label
      }
    }
  }
  return out
}

// ── Flatten to rows ─────────────────────────────────────────────────────────

/** Build a ButtonRow for one control at one location. */
function rowFor(loc: ControlLocation, control: RawControl): ButtonRow {
  return {
    id: `${loc.page}/${loc.row}/${loc.column}`,
    loc,
    type: controlType(control),
    text: getText(control),
    bgcolor: getBgColor(control),
    color: getColor(control),
    size: getSize(control),
    alignment: getAlignment(control),
    stepCount: stepCount(control),
    actionSummary: actionSummaries(control),
    feedbackSummary: feedbackSummaries(control),
    connectionIds: controlConnectionIds(control),
  }
}

/** Project every populated button slot in the config into a flat row list,
 *  ordered by page → row → column. */
export function flatten(raw: RawConfig): ButtonRow[] {
  const rows: ButtonRow[] = []
  for (const pageNum of pageNumsSorted(raw)) {
    const page = pagesOf(raw)[pageNum]
    const pageName = typeof page?.name === 'string' ? page.name : `Page ${pageNum}`
    const controls = page?.controls
    if (!controls || typeof controls !== 'object') continue
    for (const rowKey of Object.keys(controls).sort((a, b) => Number(a) - Number(b))) {
      const rowObj = controls[rowKey]
      if (!rowObj || typeof rowObj !== 'object') continue
      for (const colKey of Object.keys(rowObj).sort((a, b) => Number(a) - Number(b))) {
        const ctrl = rowObj[colKey]
        if (!ctrl || typeof ctrl !== 'object') continue
        const loc: ControlLocation = {
          page: Number(pageNum),
          row: Number(rowKey),
          column: Number(colKey),
          pageName,
        }
        rows.push(rowFor(loc, ctrl))
      }
    }
  }
  return rows
}

/** Re-derive a single row from the current raw config (after a mutation). */
export function refreshRow(raw: RawConfig, loc: ControlLocation): ButtonRow | null {
  const ctrl = controlAt(raw, loc)
  return ctrl ? rowFor(loc, ctrl) : null
}

// ── Metadata ────────────────────────────────────────────────────────────────

export function metaOf(raw: RawConfig, rowCount: number): ConfigMeta {
  return {
    version: raw?.version ?? null,
    type: typeof raw?.type === 'string' ? raw.type : null,
    companionBuild: typeof raw?.companionBuild === 'string' ? raw.companionBuild : null,
    pageCount: pageNumsSorted(raw).length,
    buttonCount: rowCount,
  }
}

// ── Cell edit ───────────────────────────────────────────────────────────────

/** Apply a single style-field edit to the control at `loc`. Returns true if a
 *  control existed and was edited. */
export function applyCellEdit(
  raw: RawConfig,
  loc: ControlLocation,
  field: EditableField,
  value: string,
): boolean {
  const ctrl = controlAt(raw, loc)
  if (!ctrl) return false
  setField(ctrl, field, value)
  return true
}

export function readCell(raw: RawConfig, loc: ControlLocation, field: EditableField): string {
  const ctrl = controlAt(raw, loc)
  return ctrl ? getField(ctrl, field) : ''
}

// ── Find & replace ──────────────────────────────────────────────────────────

function buildMatcher(q: ReplaceQuery): { test: (s: string) => boolean; apply: (s: string) => string } {
  if (q.regex) {
    const flags = q.caseSensitive ? 'g' : 'gi'
    const re = new RegExp(q.find, flags)
    return {
      test: (s) => {
        re.lastIndex = 0
        return re.test(s)
      },
      apply: (s) => s.replace(new RegExp(q.find, flags), q.replace),
    }
  }
  const needle = q.caseSensitive ? q.find : q.find.toLowerCase()
  return {
    test: (s) => (q.caseSensitive ? s : s.toLowerCase()).includes(needle),
    apply: (s) => {
      if (q.caseSensitive) return s.split(q.find).join(q.replace)
      // case-insensitive literal replace
      return s.replace(
        new RegExp(q.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        q.replace,
      )
    },
  }
}

/** Walk every string value inside an object, invoking `visit(path, value)`. If
 *  `visit` returns a string it replaces the value in place. */
function walkStrings(
  obj: any,
  visit: (path: string, value: string) => string | void,
  path = '',
): void {
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`))
  } else if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k]
      const p = path ? `${path}.${k}` : k
      if (typeof v === 'string') {
        const out = visit(p, v)
        if (typeof out === 'string') obj[k] = out
      } else {
        walkStrings(v, visit, p)
      }
    }
  }
}

/** The set of raw sub-objects a scope touches for a given control. */
function scopeTargets(control: RawControl, scope: ReplaceQuery['scope']): { label: string; obj: any }[] {
  const targets: { label: string; obj: any }[] = []
  if (scope === 'text' || scope === 'all') {
    if (control.style) targets.push({ label: 'style', obj: control.style })
  }
  if (scope === 'actionOptions' || scope === 'all') {
    if (control.steps) targets.push({ label: 'actions', obj: control.steps })
  }
  if (scope === 'feedbackOptions' || scope === 'all') {
    if (control.feedbacks) targets.push({ label: 'feedbacks', obj: control.feedbacks })
  }
  return targets
}

function rowMatchesFilter(id: string, q: ReplaceQuery): boolean {
  return !q.onlyIds || q.onlyIds.includes(id)
}

/** Preview matches without mutating. */
export function previewReplace(raw: RawConfig, q: ReplaceQuery): ReplaceMatch[] {
  if (!q.find) return []
  const matcher = buildMatcher(q)
  const matches: ReplaceMatch[] = []
  for (const row of flatten(raw)) {
    if (!rowMatchesFilter(row.id, q)) continue
    const ctrl = controlAt(raw, row.loc)
    if (!ctrl) continue
    for (const target of scopeTargets(ctrl, q.scope)) {
      walkStrings(target.obj, (p, value) => {
        if (matcher.test(value)) {
          matches.push({
            id: row.id,
            where: `${target.label}.${p}`,
            before: value,
            after: matcher.apply(value),
          })
        }
      })
    }
  }
  return matches
}

/** Apply the replacement in place. Returns the number of string values changed. */
export function applyReplace(raw: RawConfig, q: ReplaceQuery): number {
  if (!q.find) return 0
  const matcher = buildMatcher(q)
  let changed = 0
  for (const row of flatten(raw)) {
    if (!rowMatchesFilter(row.id, q)) continue
    const ctrl = controlAt(raw, row.loc)
    if (!ctrl) continue
    for (const target of scopeTargets(ctrl, q.scope)) {
      walkStrings(target.obj, (_p, value) => {
        if (matcher.test(value)) {
          changed++
          return matcher.apply(value)
        }
      })
    }
  }
  return changed
}

// ── Templates ───────────────────────────────────────────────────────────────

/** A deep structured clone usable in both runtimes. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** Capture the control at `loc` as a template body (deep-cloned). */
export function captureControl(raw: RawConfig, loc: ControlLocation): RawControl | null {
  const ctrl = controlAt(raw, loc)
  return ctrl ? clone(ctrl) : null
}

/** Substitute {{n}}, {{row}}, {{col}}, {{page}} tokens in every string of a
 *  freshly-cloned control. `n` is the 1-based index within the stamped set. */
function substituteTokens(control: RawControl, ctx: { n: number; loc: ControlLocation }): void {
  const map: Record<string, string> = {
    n: String(ctx.n),
    row: String(ctx.loc.row),
    col: String(ctx.loc.column),
    column: String(ctx.loc.column),
    page: String(ctx.loc.page),
  }
  walkStrings(control, (_p, value) =>
    value.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, key) => (key in map ? map[key] : whole)),
  )
}

/** Stamp `template` onto each target location, applying token substitution per
 *  target (1-based index in the given order). Returns the count stamped. */
export function stampTemplate(
  raw: RawConfig,
  template: ButtonTemplate,
  targets: ControlLocation[],
): number {
  let n = 0
  for (const loc of targets) {
    n++
    const fresh = clone(template.control)
    substituteTokens(fresh, { n, loc })
    setControlAt(raw, loc, fresh)
  }
  return n
}

// ── Re-exports used by callers that only import normalize ───────────────────
export { allFeedbacks }
