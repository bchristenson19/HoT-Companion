// ── HoT Companion — Button Details panel ────────────────────────────────────
// Select one button → see and edit everything it does: each step's action sets
// (When pressed / released / rotated) and its feedbacks (status lights). Each
// action/feedback shows its connection, type, and every option as an editable
// key/value list, with add / remove / reorder / duplicate and a raw-JSON toggle.
//
// Module option *schemas* aren't in the export file, so options are shown by
// their raw keys — the honest, complete view of what the file holds.

import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { detailTargetAtom, loadedAtom, detailTickAtom } from '../state/atoms'
import { useDetailEdit } from '../state/actions'
import { ICON } from '../lib/glyphs'
import { buildDetail } from '@shared/companion/detail'
import * as D from '@shared/companion/detail'
import type {
  ActionAddr,
  EntityView,
  FeedbackAddr,
  ControlLocation,
} from '@shared/types'

export function DetailPanel(): JSX.Element {
  const target = useAtomValue(detailTargetAtom)
  const loaded = useAtomValue(loadedAtom)
  // Subscribe to the tick so in-place mutations re-render the panel.
  useAtomValue(detailTickAtom)

  if (!loaded) return <aside className="detail-panel" />

  if (!target) {
    return (
      <aside className="detail-panel">
        <div className="detail-empty">
          <div className="detail-empty-icon">{ICON.details}</div>
          <p>Select a single button to see and edit what it does.</p>
          <p className="detail-empty-sub">
            Click one row in the list. (Selecting many is for bulk appearance edits.)
          </p>
        </div>
      </aside>
    )
  }

  const detail = buildDetail(loaded.raw, target.loc)
  const connections = loaded.connections

  return (
    <aside className="detail-panel">
      <header className="detail-head">
        <div className="detail-title">
          <span className="detail-loc">
            P{target.loc.page} · {target.loc.row}·{target.loc.column}
          </span>
          <span className="detail-name">{target.text || '(no label)'}</span>
        </div>
        <div className="detail-sub">What this button does</div>
      </header>

      {!detail || !detail.editable ? (
        <div className="detail-empty">
          <p>This is a {detail?.type || 'special'} button — it has no editable actions.</p>
        </div>
      ) : (
        <>
          <ActionsSection loc={target.loc} detail={detail} connections={connections} />
          <FeedbacksSection loc={target.loc} detail={detail} connections={connections} />
        </>
      )}
    </aside>
  )
}

// ── Actions ─────────────────────────────────────────────────────────────────

function ActionsSection({
  loc,
  detail,
  connections,
}: {
  loc: ControlLocation
  detail: NonNullable<ReturnType<typeof buildDetail>>
  connections: Record<string, string>
}): JSX.Element {
  const { run } = useDetailEdit()
  const multiStep = detail.steps.length > 1

  return (
    <section className="detail-section">
      <h4>
        <span className="col-icon">{ICON.actions}</span> Functions
      </h4>
      {detail.steps.length === 0 && <div className="detail-note">No steps on this button.</div>}
      {detail.steps.map((step) => (
        <div className="detail-step" key={step.stepId}>
          {multiStep && (
            <div className="step-head">
              <span className="col-icon">{ICON.step}</span> Step {Number(step.stepId) + 1}
            </div>
          )}
          {step.sets.map((set) => (
            <div className="action-set" key={set.setKey}>
              <div className="set-label">{set.label}</div>
              {set.actions.map((a, i) => (
                <ActionCard
                  key={`${set.setKey}-${i}`}
                  addr={{ loc, stepId: step.stepId, setKey: set.setKey, index: i }}
                  view={a}
                  count={set.actions.length}
                  connections={connections}
                />
              ))}
              <AddEntity
                connections={connections}
                onAdd={(connId, typeId) =>
                  run(
                    (raw) => D.addAction(raw, loc, step.stepId, set.setKey, connId, typeId),
                    'Action added',
                  )
                }
                label="action"
              />
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

function ActionCard({
  addr,
  view,
  count,
  connections,
}: {
  addr: ActionAddr
  view: EntityView
  count: number
  connections: Record<string, string>
}): JSX.Element {
  const { run } = useDetailEdit()
  return (
    <EntityCard
      view={view}
      connections={connections}
      count={count}
      onSetConnection={(id) => run((raw) => D.setActionConnection(raw, addr, id))}
      onSetType={(t) => run((raw) => D.setActionType(raw, addr, t))}
      onSetOption={(k, v) => run((raw) => D.setActionOption(raw, addr, k, v))}
      onAddOption={(k) => run((raw) => D.addActionOption(raw, addr, k), 'Setting added')}
      onRemoveOption={(k) => run((raw) => D.removeActionOption(raw, addr, k))}
      onMove={(d) => run((raw) => D.moveAction(raw, addr, d) >= 0)}
      onDuplicate={() => run((raw) => D.duplicateAction(raw, addr), 'Action duplicated')}
      onDelete={() => run((raw) => D.removeAction(raw, addr), 'Action removed')}
      onReplaceRaw={(obj) => run((raw) => D.replaceActionRaw(raw, addr, obj), 'Action updated')}
      extra={
        <label className="card-field">
          <span className="card-field-label">{ICON.delay} Delay (ms)</span>
          <input
            className="input card-input-sm"
            type="number"
            defaultValue={view.delay ?? 0}
            onBlur={(e) => run((raw) => D.setActionDelay(raw, addr, Number(e.target.value)))}
          />
        </label>
      }
    />
  )
}

// ── Feedbacks ─────────────────────────────────────────────────────────────

function FeedbacksSection({
  loc,
  detail,
  connections,
}: {
  loc: ControlLocation
  detail: NonNullable<ReturnType<typeof buildDetail>>
  connections: Record<string, string>
}): JSX.Element {
  const { run } = useDetailEdit()
  return (
    <section className="detail-section">
      <h4>
        <span className="col-icon">{ICON.feedbacks}</span> Status lights
      </h4>
      {detail.feedbacks.length === 0 && (
        <div className="detail-note">No status-light rules on this button.</div>
      )}
      {detail.feedbacks.map((f, i) => (
        <FeedbackCard
          key={i}
          addr={{ loc, index: i }}
          view={f}
          count={detail.feedbacks.length}
          connections={connections}
        />
      ))}
      <AddEntity
        connections={connections}
        onAdd={(connId, typeId) => run((raw) => D.addFeedback(raw, loc, connId, typeId), 'Status light added')}
        label="status light"
      />
    </section>
  )
}

function FeedbackCard({
  addr,
  view,
  count,
  connections,
}: {
  addr: FeedbackAddr
  view: EntityView
  count: number
  connections: Record<string, string>
}): JSX.Element {
  const { run } = useDetailEdit()
  return (
    <EntityCard
      view={view}
      connections={connections}
      count={count}
      onSetConnection={(id) => run((raw) => D.setFeedbackConnection(raw, addr, id))}
      onSetType={(t) => run((raw) => D.setFeedbackType(raw, addr, t))}
      onSetOption={(k, v) => run((raw) => D.setFeedbackOption(raw, addr, k, v))}
      onAddOption={(k) => run((raw) => D.addFeedbackOption(raw, addr, k), 'Setting added')}
      onRemoveOption={(k) => run((raw) => D.removeFeedbackOption(raw, addr, k))}
      onMove={(d) => run((raw) => D.moveFeedback(raw, addr, d) >= 0)}
      onDuplicate={() => run((raw) => D.duplicateFeedback(raw, addr), 'Status light duplicated')}
      onDelete={() => run((raw) => D.removeFeedback(raw, addr), 'Status light removed')}
      onReplaceRaw={(obj) => run((raw) => D.replaceFeedbackRaw(raw, addr, obj), 'Status light updated')}
      extra={
        <label className="card-check">
          <input
            type="checkbox"
            defaultChecked={view.isInverted ?? false}
            onChange={(e) => run((raw) => D.setFeedbackInverted(raw, addr, e.target.checked))}
          />
          Show when the condition is false (inverted)
        </label>
      }
    />
  )
}

// ── Shared entity card ──────────────────────────────────────────────────────

function EntityCard({
  view,
  connections,
  count,
  onSetConnection,
  onSetType,
  onSetOption,
  onAddOption,
  onRemoveOption,
  onMove,
  onDuplicate,
  onDelete,
  onReplaceRaw,
  extra,
}: {
  view: EntityView
  connections: Record<string, string>
  count: number
  onSetConnection: (id: string) => void
  onSetType: (t: string) => void
  onSetOption: (k: string, v: string) => void
  onAddOption: (k: string) => void
  onRemoveOption: (k: string) => void
  onMove: (delta: number) => void
  onDuplicate: () => void
  onDelete: () => void
  onReplaceRaw: (obj: unknown) => void
  extra?: JSX.Element
}): JSX.Element {
  const [rawMode, setRawMode] = useState(false)
  const connIds = Object.keys(connections)

  return (
    <div className="entity-card">
      <div className="card-tools">
        <span className="card-type" title="Module action/feedback id">
          {view.typeId || '(type?)'}
        </span>
        <span className="card-spacer" />
        <button className="icon-btn" title="Move up" onClick={() => onMove(-1)} disabled={count < 2}>
          {ICON.up}
        </button>
        <button className="icon-btn" title="Move down" onClick={() => onMove(1)} disabled={count < 2}>
          {ICON.down}
        </button>
        <button className="icon-btn" title="Duplicate" onClick={onDuplicate}>
          {ICON.dup}
        </button>
        <button
          className={`icon-btn ${rawMode ? 'on' : ''}`}
          title="Edit raw JSON"
          onClick={() => setRawMode((v) => !v)}
        >
          {ICON.raw}
        </button>
        <button className="icon-btn danger" title="Delete" onClick={onDelete}>
          {ICON.trash}
        </button>
      </div>

      {rawMode ? (
        <RawEditor json={view.rawJson} onSave={onReplaceRaw} onClose={() => setRawMode(false)} />
      ) : (
        <>
          <label className="card-field">
            <span className="card-field-label">{ICON.connection} Connection</span>
            <select
              className="input"
              value={view.connectionId ?? ''}
              onChange={(e) => onSetConnection(e.target.value)}
            >
              {view.connectionId && !connIds.includes(view.connectionId) && (
                <option value={view.connectionId}>{view.connectionId} (missing)</option>
              )}
              {connIds.map((id) => (
                <option key={id} value={id}>
                  {connections[id]}
                </option>
              ))}
            </select>
          </label>

          <label className="card-field">
            <span className="card-field-label">Type id</span>
            <input
              className="input"
              defaultValue={view.typeId}
              onBlur={(e) => {
                if (e.target.value !== view.typeId) onSetType(e.target.value)
              }}
            />
          </label>

          <OptionEditor options={view.options} onSetOption={onSetOption} onAddOption={onAddOption} onRemoveOption={onRemoveOption} />

          {extra}
        </>
      )}
    </div>
  )
}

// ── Option key/value editor ─────────────────────────────────────────────────

function OptionEditor({
  options,
  onSetOption,
  onAddOption,
  onRemoveOption,
}: {
  options: EntityView['options']
  onSetOption: (k: string, v: string) => void
  onAddOption: (k: string) => void
  onRemoveOption: (k: string) => void
}): JSX.Element {
  const [newKey, setNewKey] = useState('')
  return (
    <div className="opt-editor">
      <div className="opt-editor-label">Settings</div>
      {options.length === 0 && <div className="detail-note">No settings.</div>}
      {options.map((o) => (
        <div className="opt-row" key={o.key}>
          <span className="opt-key" title={`type: ${o.valueType}`}>
            {o.key}
          </span>
          <input
            className="input opt-val"
            defaultValue={o.value}
            onBlur={(e) => {
              if (e.target.value !== o.value) onSetOption(o.key, e.target.value)
            }}
          />
          <button className="icon-btn danger" title="Remove setting" onClick={() => onRemoveOption(o.key)}>
            {ICON.trash}
          </button>
        </div>
      ))}
      <div className="opt-add">
        <input
          className="input opt-val"
          placeholder="new setting key"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newKey.trim()) {
              onAddOption(newKey.trim())
              setNewKey('')
            }
          }}
        />
        <button
          className="icon-btn"
          title="Add setting"
          disabled={!newKey.trim()}
          onClick={() => {
            onAddOption(newKey.trim())
            setNewKey('')
          }}
        >
          {ICON.addItem}
        </button>
      </div>
    </div>
  )
}

// ── Raw JSON editor ─────────────────────────────────────────────────────────

function RawEditor({
  json,
  onSave,
  onClose,
}: {
  json: string
  onSave: (obj: unknown) => void
  onClose: () => void
}): JSX.Element {
  const [text, setText] = useState(json)
  const [error, setError] = useState<string | null>(null)

  const save = (): void => {
    try {
      const obj = JSON.parse(text)
      setError(null)
      onSave(obj)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="raw-edit">
      <textarea
        className={`raw-json ${error ? 'bad' : ''}`}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        rows={Math.min(20, text.split('\n').length + 1)}
      />
      {error && <div className="form-error">Invalid JSON: {error}</div>}
      <div className="raw-edit-btns">
        <button className="btn" onClick={save}>
          Save JSON
        </button>
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add-entity inline form ──────────────────────────────────────────────────

function AddEntity({
  connections,
  onAdd,
  label,
}: {
  connections: Record<string, string>
  onAdd: (connectionId: string, typeId: string) => void
  label: string
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const connIds = Object.keys(connections)
  const [conn, setConn] = useState(connIds[0] ?? '')
  const [typeId, setTypeId] = useState('')

  if (!open) {
    return (
      <button className="add-entity-btn" onClick={() => setOpen(true)}>
        {ICON.addItem} Add {label}
      </button>
    )
  }

  return (
    <div className="add-entity-form">
      <select className="input" value={conn} onChange={(e) => setConn(e.target.value)}>
        {connIds.length === 0 && <option value="">(no connections in file)</option>}
        {connIds.map((id) => (
          <option key={id} value={id}>
            {connections[id]}
          </option>
        ))}
      </select>
      <input
        className="input"
        placeholder={`${label} type id (e.g. route)`}
        value={typeId}
        onChange={(e) => setTypeId(e.target.value)}
      />
      <div className="add-entity-btns">
        <button
          className="btn"
          disabled={!conn || !typeId.trim()}
          onClick={() => {
            onAdd(conn, typeId.trim())
            setTypeId('')
            setOpen(false)
          }}
        >
          Add
        </button>
        <button className="btn ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
