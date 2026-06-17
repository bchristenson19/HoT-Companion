// ── HoT Companion — shared types ────────────────────────────────────────────
// The single source of truth for the contract between main and renderer.
// Imported by the renderer via the @shared alias and surfaced through the
// typed window.api bridge.
//
// A .companionconfig file is gzipped JSON. We keep the *raw* parsed object as
// the source of truth (so fields we don't understand survive a round-trip) and
// project a flat list of editable ButtonRows on top of it for the grid.

/** Opaque raw Companion export object. Shape is firmware/version dependent and
 *  largely `Record<string, any>`; we never discard keys we don't recognise. */
export type RawConfig = Record<string, any>

/** A single button control as stored in the raw config (open shape). */
export type RawControl = Record<string, any>

// ── Loaded document ─────────────────────────────────────────────────────────

/** Everything the renderer needs after opening a file. The raw object is sent
 *  along so edits can be written back into it without losing unknown fields. */
export interface LoadedConfig {
  /** Absolute path the file was read from (for save / save-as defaults). */
  path: string
  /** File basename, for the titlebar. */
  fileName: string
  /** Top-level export metadata, surfaced read-only in the UI. */
  meta: ConfigMeta
  /** The raw parsed export — round-trip source of truth. */
  raw: RawConfig
  /** Flattened, editable view of every button. */
  rows: ButtonRow[]
  /** connectionId -> human label, from the export's `instances`. */
  connections: Record<string, string>
}

export interface ConfigMeta {
  version: number | string | null
  type: string | null
  companionBuild: string | null
  pageCount: number
  buttonCount: number
}

// ── Editable projection ─────────────────────────────────────────────────────

/** A button flattened for the spreadsheet grid. `loc` uniquely identifies the
 *  control's slot in the raw config so edits write back to the right place. */
export interface ButtonRow {
  /** Stable key: `${page}/${row}/${column}`. */
  id: string
  loc: ControlLocation
  /** Control type, e.g. 'button-layered', 'pageup'. Empty slots are omitted. */
  type: string
  /** First text layer's text (the common "button label"). '' if none. */
  text: string
  /** Background color as #rrggbb (best-effort from style/layers). */
  bgcolor: string
  /** Foreground/text color as #rrggbb. */
  color: string
  /** Font size — number or 'auto'. */
  size: string
  /** Text alignment, e.g. 'center:center'. */
  alignment: string
  /** Count of steps defined on the control. */
  stepCount: number
  /** One-line summaries of the actions across all steps. */
  actionSummary: string[]
  /** One-line summaries of the feedbacks. */
  feedbackSummary: string[]
  /** connectionIds referenced by this button's actions/feedbacks. */
  connectionIds: string[]
}

export interface ControlLocation {
  page: number
  row: number
  column: number
  /** Page name, for display/grouping. */
  pageName: string
}

/** The set of fields the grid can edit directly (style-only). Everything else
 *  is edited via find&replace, templates, or the raw JSON editor. */
export type EditableField = 'text' | 'bgcolor' | 'color' | 'size' | 'alignment'

/** A single cell edit: set `field` on the control at `id` to `value`. */
export interface CellEdit {
  id: string
  field: EditableField
  value: string
}

// ── Templates (persisted to disk) ───────────────────────────────────────────

/** A captured button definition that can be stamped onto a selection. Holds the
 *  control's style/steps/feedbacks verbatim; `{{n}}`/`{{row}}`/`{{col}}` tokens
 *  inside string values are substituted per-target at stamp time. */
export interface ButtonTemplate {
  id: string
  name: string
  /** The captured control object (style, steps, feedbacks, options, type). */
  control: RawControl
  /** ISO timestamp captured. */
  created: string
}

// ── Find & replace ──────────────────────────────────────────────────────────

export type ReplaceScope = 'text' | 'actionOptions' | 'feedbackOptions' | 'all'

export interface ReplaceQuery {
  find: string
  replace: string
  scope: ReplaceScope
  regex: boolean
  caseSensitive: boolean
  /** When set, restrict to these button ids (the grid selection). */
  onlyIds?: string[]
}

/** One match preview line returned before applying. */
export interface ReplaceMatch {
  id: string
  where: string
  before: string
  after: string
}

// ── Button detail (inspector + action/feedback editing) ─────────────────────
// Addresses locate an action or feedback by POSITION, never by pointer, so they
// survive the structured-clone across IPC and a save round-trip.

/** Which action set within a step an action lives in. */
export type ActionSetKey = 'down' | 'up' | 'rotate' | string

/** Position of one action inside a control. */
export interface ActionAddr {
  loc: ControlLocation
  stepId: string
  setKey: ActionSetKey
  index: number
}

/** Position of one feedback inside a control. */
export interface FeedbackAddr {
  loc: ControlLocation
  index: number
}

/** A single option as an editable key/value pair (value stringified for the UI;
 *  the mutators re-type it to match the stored value where sensible). */
export interface OptionPair {
  key: string
  value: string
  /** The JS type of the stored value, so the editor can hint / round-trip it. */
  valueType: 'string' | 'number' | 'boolean' | 'json'
}

/** A display/edit view of one action or feedback. */
export interface EntityView {
  connectionId: string | null
  connectionLabel: string
  typeId: string
  options: OptionPair[]
  /** Action-only: delay in ms (if present). */
  delay?: number
  /** Feedback-only: show-when-false flag (if present). */
  isInverted?: boolean
  /** Pretty-printed raw JSON for the raw-edit escape hatch. */
  rawJson: string
}

export interface ActionSetView {
  setKey: ActionSetKey
  label: string
  actions: EntityView[]
}

export interface StepView {
  stepId: string
  sets: ActionSetView[]
}

export interface ButtonDetail {
  type: string
  /** Whether the control supports steps/feedbacks at all (nav buttons don't). */
  editable: boolean
  steps: StepView[]
  feedbacks: EntityView[]
}

// ── IPC results ─────────────────────────────────────────────────────────────

/** Result of an open dialog + load; null `path` means the user cancelled. */
export interface OpenResult {
  loaded: LoadedConfig | null
}

export interface SaveResult {
  path: string | null
}

/** App settings persisted to disk (recent files, last directory). */
export interface AppSettings {
  recentFiles: string[]
  lastDir: string
}
