// ── HoT Companion — button detail (read + edit actions/feedbacks) ────────────
// Pure functions (no node/electron deps) so they run in the renderer on its own
// copy of the raw config. Everything is addressed by POSITION (ControlLocation +
// step/set/index) so edits survive the IPC structured-clone and a save
// round-trip, and untouched sibling fields are always preserved.

import type {
  RawConfig,
  RawControl,
  ControlLocation,
  ActionAddr,
  ActionSetKey,
  FeedbackAddr,
  ButtonDetail,
  EntityView,
  OptionPair,
  StepView,
  ActionSetView,
} from '../types'
import { stepEntries, entityConnectionId } from './model'
import { controlAt, connectionLabels } from './normalize'

// ── Field-name helpers (version differences) ────────────────────────────────

const CONN_KEYS = ['connectionId', 'instance', 'instance_id']
const ACTION_TYPE_KEYS = ['actionId', 'action']
const FEEDBACK_TYPE_KEYS = ['feedbackId', 'type']

function firstKey(obj: RawControl, keys: string[]): string | null {
  for (const k of keys) if (k in obj) return k
  return null
}

function typeIdOf(entity: RawControl, keys: string[]): string {
  for (const k of keys) {
    const v = entity?.[k]
    if (typeof v === 'string' && v) return v
  }
  return ''
}

// ── Options projection ──────────────────────────────────────────────────────

function valueType(v: unknown): OptionPair['valueType'] {
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'string') return 'string'
  return 'json'
}

function valueToString(v: unknown): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return JSON.stringify(v)
}

function optionPairs(entity: RawControl): OptionPair[] {
  const opts = entity?.options
  if (!opts || typeof opts !== 'object') return []
  return Object.keys(opts).map((key) => ({
    key,
    value: valueToString(opts[key]),
    valueType: valueType(opts[key]),
  }))
}

/** Coerce a user-typed string back toward the option's stored type. */
function coerceValue(input: string, vt: OptionPair['valueType']): unknown {
  switch (vt) {
    case 'number': {
      const n = Number(input)
      return Number.isNaN(n) ? input : n
    }
    case 'boolean':
      return input === 'true' ? true : input === 'false' ? false : input
    case 'json':
      try {
        return JSON.parse(input)
      } catch {
        return input
      }
    case 'string':
    default:
      return input
  }
}

// ── EntityView builders ─────────────────────────────────────────────────────

function entityView(entity: RawControl, conns: Record<string, string>, kind: 'action' | 'feedback'): EntityView {
  const connectionId = entityConnectionId(entity)
  const typeId = typeIdOf(entity, kind === 'action' ? ACTION_TYPE_KEYS : FEEDBACK_TYPE_KEYS)
  const view: EntityView = {
    connectionId,
    connectionLabel: connectionId ? conns[connectionId] ?? connectionId : '(none)',
    typeId,
    options: optionPairs(entity),
    rawJson: JSON.stringify(entity, null, 2),
  }
  if (kind === 'action' && typeof entity?.delay === 'number') view.delay = entity.delay
  if (kind === 'feedback' && typeof entity?.isInverted === 'boolean') view.isInverted = entity.isInverted
  return view
}

const SET_LABELS: Record<string, string> = {
  down: 'When pressed',
  up: 'When released',
  rotate: 'When rotated',
  rotate_left: 'When rotated left',
  rotate_right: 'When rotated right',
}

function setLabel(setKey: string): string {
  return SET_LABELS[setKey] ?? `Set: ${setKey}`
}

/** Preferred order for action sets within a step. */
function orderedSetKeys(actionSets: RawControl): string[] {
  const keys = Object.keys(actionSets)
  const pref = ['down', 'up', 'rotate', 'rotate_left', 'rotate_right']
  return [...keys].sort((a, b) => {
    const ai = pref.indexOf(a)
    const bi = pref.indexOf(b)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
}

const NAV_TYPES = new Set(['pageup', 'pagedown', 'pagenum'])

/** Project a control into a full display/edit structure. */
export function buildDetail(raw: RawConfig, loc: ControlLocation): ButtonDetail | null {
  const control = controlAt(raw, loc)
  if (!control) return null
  const type = typeof control.type === 'string' ? control.type : ''
  const conns = connectionLabels(raw)

  if (NAV_TYPES.has(type)) {
    return { type, editable: false, steps: [], feedbacks: [] }
  }

  const steps: StepView[] = stepEntries(control).map(({ stepId, step }) => {
    const actionSets = step?.action_sets
    const sets: ActionSetView[] = []
    if (actionSets && typeof actionSets === 'object') {
      for (const setKey of orderedSetKeys(actionSets)) {
        const arr = actionSets[setKey]
        if (!Array.isArray(arr)) continue
        sets.push({
          setKey,
          label: setLabel(setKey),
          actions: arr.filter(Boolean).map((a: RawControl) => entityView(a, conns, 'action')),
        })
      }
    }
    return { stepId, sets }
  })

  const feedbacks = (Array.isArray(control.feedbacks) ? control.feedbacks.filter(Boolean) : []).map(
    (f: RawControl) => entityView(f, conns, 'feedback'),
  )

  return { type, editable: true, steps, feedbacks }
}

// ── Locating the live array/entity for a mutation ───────────────────────────

function actionArray(raw: RawConfig, addr: ActionAddr): RawControl[] | null {
  const control = controlAt(raw, addr.loc)
  const step = control?.steps?.[addr.stepId]
  const arr = step?.action_sets?.[addr.setKey]
  return Array.isArray(arr) ? arr : null
}

function actionAt(raw: RawConfig, addr: ActionAddr): RawControl | null {
  const arr = actionArray(raw, addr)
  const a = arr?.[addr.index]
  return a && typeof a === 'object' ? a : null
}

function feedbackArray(raw: RawConfig, loc: ControlLocation): RawControl[] | null {
  const control = controlAt(raw, loc)
  if (!control) return null
  if (!Array.isArray(control.feedbacks)) return null
  return control.feedbacks
}

function feedbackAt(raw: RawConfig, addr: FeedbackAddr): RawControl | null {
  const arr = feedbackArray(raw, addr.loc)
  const f = arr?.[addr.index]
  return f && typeof f === 'object' ? f : null
}

// ── Fresh ids ───────────────────────────────────────────────────────────────
// Companion uses opaque string ids; uniqueness within the control is enough.

let idCounter = 0
function newEntityId(): string {
  idCounter = (idCounter + 1) % 1_000_000
  // Date is available in the renderer; combine with a counter for uniqueness.
  return `e_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

// ── Option mutations ────────────────────────────────────────────────────────

function ensureOptions(entity: RawControl): RawControl {
  if (!entity.options || typeof entity.options !== 'object') entity.options = {}
  return entity.options
}

export function setActionOption(raw: RawConfig, addr: ActionAddr, key: string, value: string): boolean {
  const a = actionAt(raw, addr)
  if (!a) return false
  const opts = ensureOptions(a)
  opts[key] = coerceValue(value, valueType(opts[key]))
  return true
}

export function setFeedbackOption(raw: RawConfig, addr: FeedbackAddr, key: string, value: string): boolean {
  const f = feedbackAt(raw, addr)
  if (!f) return false
  const opts = ensureOptions(f)
  opts[key] = coerceValue(value, valueType(opts[key]))
  return true
}

function addOptionTo(entity: RawControl | null, key: string): boolean {
  if (!entity || !key) return false
  const opts = ensureOptions(entity)
  if (key in opts) return false
  opts[key] = ''
  return true
}

export function addActionOption(raw: RawConfig, addr: ActionAddr, key: string): boolean {
  return addOptionTo(actionAt(raw, addr), key)
}
export function addFeedbackOption(raw: RawConfig, addr: FeedbackAddr, key: string): boolean {
  return addOptionTo(feedbackAt(raw, addr), key)
}

function removeOptionFrom(entity: RawControl | null, key: string): boolean {
  if (!entity?.options || typeof entity.options !== 'object') return false
  if (!(key in entity.options)) return false
  delete entity.options[key]
  return true
}

export function removeActionOption(raw: RawConfig, addr: ActionAddr, key: string): boolean {
  return removeOptionFrom(actionAt(raw, addr), key)
}
export function removeFeedbackOption(raw: RawConfig, addr: FeedbackAddr, key: string): boolean {
  return removeOptionFrom(feedbackAt(raw, addr), key)
}

// ── Connection ──────────────────────────────────────────────────────────────

function setConnOn(entity: RawControl | null, connectionId: string): boolean {
  if (!entity) return false
  const existing = firstKey(entity, CONN_KEYS)
  entity[existing ?? 'connectionId'] = connectionId
  return true
}

export function setActionConnection(raw: RawConfig, addr: ActionAddr, connectionId: string): boolean {
  return setConnOn(actionAt(raw, addr), connectionId)
}
export function setFeedbackConnection(raw: RawConfig, addr: FeedbackAddr, connectionId: string): boolean {
  return setConnOn(feedbackAt(raw, addr), connectionId)
}

// ── Type id ─────────────────────────────────────────────────────────────────

function setTypeOn(entity: RawControl | null, keys: string[], typeId: string): boolean {
  if (!entity) return false
  const existing = firstKey(entity, keys)
  entity[existing ?? keys[0]] = typeId
  return true
}

export function setActionType(raw: RawConfig, addr: ActionAddr, typeId: string): boolean {
  return setTypeOn(actionAt(raw, addr), ACTION_TYPE_KEYS, typeId)
}
export function setFeedbackType(raw: RawConfig, addr: FeedbackAddr, typeId: string): boolean {
  return setTypeOn(feedbackAt(raw, addr), FEEDBACK_TYPE_KEYS, typeId)
}

// ── Action delay / feedback inverted ────────────────────────────────────────

export function setActionDelay(raw: RawConfig, addr: ActionAddr, delayMs: number): boolean {
  const a = actionAt(raw, addr)
  if (!a) return false
  a.delay = Number.isFinite(delayMs) ? delayMs : 0
  return true
}

export function setFeedbackInverted(raw: RawConfig, addr: FeedbackAddr, inverted: boolean): boolean {
  const f = feedbackAt(raw, addr)
  if (!f) return false
  f.isInverted = inverted
  return true
}

// ── Add / remove / move / duplicate ─────────────────────────────────────────

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

/** Make a new action/feedback skeleton with a fresh id + empty options. */
function newEntity(connectionId: string, typeId: string, kind: 'action' | 'feedback'): RawControl {
  const base: RawControl = { id: newEntityId(), connectionId, options: {} }
  base[kind === 'action' ? 'actionId' : 'feedbackId'] = typeId
  return base
}

export function addAction(
  raw: RawConfig,
  loc: ControlLocation,
  stepId: string,
  setKey: ActionSetKey,
  connectionId: string,
  typeId: string,
): boolean {
  const arr = actionArray(raw, { loc, stepId, setKey, index: 0 })
  if (!arr) return false
  arr.push(newEntity(connectionId, typeId, 'action'))
  return true
}

export function addFeedback(raw: RawConfig, loc: ControlLocation, connectionId: string, typeId: string): boolean {
  const control = controlAt(raw, loc)
  if (!control) return false
  if (!Array.isArray(control.feedbacks)) control.feedbacks = []
  control.feedbacks.push(newEntity(connectionId, typeId, 'feedback'))
  return true
}

function removeAt(arr: RawControl[] | null, index: number): boolean {
  if (!arr || index < 0 || index >= arr.length) return false
  arr.splice(index, 1)
  return true
}

export function removeAction(raw: RawConfig, addr: ActionAddr): boolean {
  return removeAt(actionArray(raw, addr), addr.index)
}
export function removeFeedback(raw: RawConfig, addr: FeedbackAddr): boolean {
  return removeAt(feedbackArray(raw, addr.loc), addr.index)
}

/** Move the element at `index` by `delta` (clamped). Returns the new index or -1. */
function moveWithin(arr: RawControl[] | null, index: number, delta: number): number {
  if (!arr || index < 0 || index >= arr.length) return -1
  const target = Math.max(0, Math.min(arr.length - 1, index + delta))
  if (target === index) return index
  const [item] = arr.splice(index, 1)
  arr.splice(target, 0, item)
  return target
}

export function moveAction(raw: RawConfig, addr: ActionAddr, delta: number): number {
  return moveWithin(actionArray(raw, addr), addr.index, delta)
}
export function moveFeedback(raw: RawConfig, addr: FeedbackAddr, delta: number): number {
  return moveWithin(feedbackArray(raw, addr.loc), addr.index, delta)
}

function duplicateAt(arr: RawControl[] | null, index: number): boolean {
  if (!arr || index < 0 || index >= arr.length) return false
  const copy = clone(arr[index])
  copy.id = newEntityId()
  arr.splice(index + 1, 0, copy)
  return true
}

export function duplicateAction(raw: RawConfig, addr: ActionAddr): boolean {
  return duplicateAt(actionArray(raw, addr), addr.index)
}
export function duplicateFeedback(raw: RawConfig, addr: FeedbackAddr): boolean {
  return duplicateAt(feedbackArray(raw, addr.loc), addr.index)
}

// ── Raw-JSON escape hatch ───────────────────────────────────────────────────

/** Replace an action/feedback wholesale with a parsed object. Returns an error
 *  string on failure, or null on success. Keeps a fresh id if none supplied. */
function replaceAt(arr: RawControl[] | null, index: number, obj: unknown): string | null {
  if (!arr || index < 0 || index >= arr.length) return 'Item no longer exists'
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return 'JSON must be an object'
  const next = obj as RawControl
  if (typeof next.id !== 'string' || !next.id) next.id = newEntityId()
  arr[index] = next
  return null
}

export function replaceActionRaw(raw: RawConfig, addr: ActionAddr, obj: unknown): string | null {
  return replaceAt(actionArray(raw, addr), addr.index, obj)
}
export function replaceFeedbackRaw(raw: RawConfig, addr: FeedbackAddr, obj: unknown): string | null {
  return replaceAt(feedbackArray(raw, addr.loc), addr.index, obj)
}
