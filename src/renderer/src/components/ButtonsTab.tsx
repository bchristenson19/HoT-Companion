// ── HoT Companion — Buttons grid ────────────────────────────────────────────
// A spreadsheet of every button: rows = buttons, columns = editable style
// fields + read-only location / action / feedback summaries. Supports
// click / ctrl-click / shift-range selection, inline cell editing, and a
// bulk bar to set one value across the whole selection (fill).

import { useAtom, useAtomValue } from 'jotai'
import { useState } from 'react'
import {
  rowsAtom,
  visibleRowsAtom,
  selectedIdsAtom,
  anchorIdAtom,
  pageFilterAtom,
  textFilterAtom,
  pagesAtom,
} from '../state/atoms'
import { useApplyEdit } from '../state/actions'
import { ICON, friendlyType } from '../lib/glyphs'
import { detailOpenAtom } from '../state/atoms'
import { DetailPanel } from './DetailPanel'
import type { ButtonRow, EditableField } from '@shared/types'

const EDITABLE_COLS: {
  field: EditableField
  label: string
  icon: string
  kind: 'text' | 'color'
  hint: string
}[] = [
  { field: 'text', label: 'Label', icon: ICON.text, kind: 'text', hint: 'The text shown on the button' },
  { field: 'bgcolor', label: 'Background', icon: ICON.bg, kind: 'color', hint: 'Button background color' },
  { field: 'color', label: 'Text color', icon: ICON.fg, kind: 'color', hint: 'Button text color' },
  { field: 'size', label: 'Text size', icon: ICON.size, kind: 'text', hint: 'Font size, or "auto"' },
  { field: 'alignment', label: 'Alignment', icon: ICON.align, kind: 'text', hint: 'Where text sits, e.g. center:center' },
]

export function ButtonsTab(): JSX.Element {
  const allRows = useAtomValue(rowsAtom)
  const rows = useAtomValue(visibleRowsAtom)
  const [selected, setSelected] = useAtom(selectedIdsAtom)
  const [anchor, setAnchor] = useAtom(anchorIdAtom)
  const [pageFilter, setPageFilter] = useAtom(pageFilterAtom)
  const [textFilter, setTextFilter] = useAtom(textFilterAtom)
  const pages = useAtomValue(pagesAtom)
  const applyEdit = useApplyEdit()
  const [detailOpen, setDetailOpen] = useAtom(detailOpenAtom)

  const selectRow = (id: string, e: React.MouseEvent): void => {
    const next = new Set(selected)
    if (e.shiftKey && anchor) {
      // Range select within the currently visible rows.
      const ids = rows.map((r) => r.id)
      const a = ids.indexOf(anchor)
      const b = ids.indexOf(id)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        for (let i = lo; i <= hi; i++) next.add(ids[i])
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setAnchor(id)
    } else {
      next.clear()
      next.add(id)
      setAnchor(id)
    }
    setSelected(next)
  }

  const selectAllVisible = (): void => setSelected(new Set(rows.map((r) => r.id)))
  const clearSelection = (): void => setSelected(new Set())

  const selectedIds = [...selected]

  return (
    <div className="buttons-tab">
      <div className="grid-toolbar">
        <div className="filter-group">
          <select
            className="input page-select"
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
          >
            <option value="">All pages</option>
            {pages.map((p) => (
              <option key={p.num} value={String(p.num)}>
                {p.num}. {p.name}
              </option>
            ))}
          </select>
          <input
            className="input filter-input"
            placeholder="Filter text / type / connection…"
            value={textFilter}
            onChange={(e) => setTextFilter(e.target.value)}
          />
        </div>
        <div className="sel-group">
          <span className="sel-count">
            {selected.size} / {allRows.length} selected
          </span>
          <button className="btn ghost" onClick={selectAllVisible}>
            Select shown
          </button>
          <button className="btn ghost" onClick={clearSelection} disabled={selected.size === 0}>
            Clear
          </button>
          <button
            className={`btn ${detailOpen ? '' : 'ghost'}`}
            onClick={() => setDetailOpen((v) => !v)}
            title="Show or hide the button details panel"
          >
            <span className="btn-icon">{ICON.details}</span> Details
          </button>
        </div>
      </div>

      <Hint>Select buttons in the list, then set one value for all of them at once.</Hint>

      <BulkBar selectedIds={selectedIds} onApply={applyEdit} />

      <div className="grid-and-detail">
      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th className="col-loc" title="Page, then row and column on that page">
                <span className="col-icon">{ICON.location}</span> Location
              </th>
              <th className="col-type" title="The kind of button">
                <span className="col-icon">{ICON.kind}</span> Kind
              </th>
              {EDITABLE_COLS.map((c) => (
                <th key={c.field} title={c.hint}>
                  <span className="col-icon">{c.icon}</span> {c.label}
                </th>
              ))}
              <th className="col-sum" title="What this button does when pressed">
                <span className="col-icon">{ICON.actions}</span> What it does
              </th>
              <th className="col-sum" title="Rules that change the button based on live status">
                <span className="col-icon">{ICON.feedbacks}</span> Status lights
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <GridRow
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onSelect={selectRow}
                onEdit={(field, value) => applyEdit([r.id], field, value)}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="grid-empty">No buttons match the filter.</div>}
      </div>
        {detailOpen && <DetailPanel />}
      </div>
    </div>
  )
}

// ── Bulk bar ────────────────────────────────────────────────────────────────

function BulkBar({
  selectedIds,
  onApply,
}: {
  selectedIds: string[]
  onApply: (ids: string[], field: EditableField, value: string) => void
}): JSX.Element {
  const [field, setField] = useState<EditableField>('text')
  const [value, setValue] = useState('')
  const disabled = selectedIds.length === 0

  const col = EDITABLE_COLS.find((c) => c.field === field)!

  return (
    <div className={`bulk-bar ${disabled ? 'is-disabled' : ''}`}>
      <span className="bulk-label">Set</span>
      <select
        className="input"
        value={field}
        onChange={(e) => setField(e.target.value as EditableField)}
      >
        {EDITABLE_COLS.map((c) => (
          <option key={c.field} value={c.field}>
            {c.label}
          </option>
        ))}
      </select>
      <span className="bulk-label">to</span>
      {col.kind === 'color' ? (
        <input
          type="color"
          className="bulk-color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={(e) => setValue(e.target.value)}
        />
      ) : null}
      <input
        className="input bulk-value"
        placeholder={col.kind === 'color' ? '#rrggbb' : 'value'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !disabled) onApply(selectedIds, field, value)
        }}
      />
      <button
        className="btn"
        disabled={disabled}
        onClick={() => onApply(selectedIds, field, value)}
        title={
          disabled
            ? 'Select one or more buttons first'
            : `Set this on all ${selectedIds.length} selected buttons`
        }
      >
        Apply to {selectedIds.length} button{selectedIds.length === 1 ? '' : 's'}
      </button>
    </div>
  )
}

// ── Inline guidance ─────────────────────────────────────────────────────────

function Hint({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="hint">
      <span className="hint-icon">{ICON.tip}</span>
      <span>{children}</span>
    </div>
  )
}

// ── Grid row ────────────────────────────────────────────────────────────────

function GridRow({
  row,
  selected,
  onSelect,
  onEdit,
}: {
  row: ButtonRow
  selected: boolean
  onSelect: (id: string, e: React.MouseEvent) => void
  onEdit: (field: EditableField, value: string) => void
}): JSX.Element {
  return (
    <tr
      className={`grid-row ${selected ? 'sel' : ''}`}
      onClick={(e) => {
        // Only treat clicks on non-input areas as selection.
        if ((e.target as HTMLElement).closest('.cell-edit')) return
        onSelect(row.id, e)
      }}
    >
      <td className="col-loc">
        <span className="loc-page">{row.loc.page}</span>
        <span className="loc-rc">
          {row.loc.row}·{row.loc.column}
        </span>
      </td>
      <td className="col-type">{friendlyType(row.type)}</td>
      {EDITABLE_COLS.map((c) => (
        <td key={c.field}>
          <EditableCell kind={c.kind} value={cellValue(row, c.field)} onCommit={(v) => onEdit(c.field, v)} />
        </td>
      ))}
      <td className="col-sum">
        <Summary items={row.actionSummary} icon={ICON.actions} noun="action" />
      </td>
      <td className="col-sum">
        <Summary items={row.feedbackSummary} icon={ICON.feedbacks} noun="rule" />
      </td>
    </tr>
  )
}

function cellValue(row: ButtonRow, field: EditableField): string {
  return row[field]
}

function Summary({
  items,
  icon,
  noun,
}: {
  items: string[]
  icon: string
  noun: string
}): JSX.Element {
  if (items.length === 0) return <span className="sum-none">— none</span>
  const label = `${items.length} ${noun}${items.length === 1 ? '' : 's'}`
  return (
    <span className="sum" title={items.join('\n')}>
      <span className="cell-icon">{icon}</span> {label}
    </span>
  )
}

// ── Editable cell ───────────────────────────────────────────────────────────

function EditableCell({
  kind,
  value,
  onCommit,
}: {
  kind: 'text' | 'color'
  value: string
  onCommit: (v: string) => void
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  if (kind === 'color') {
    const valid = /^#[0-9a-f]{6}$/i.test(value)
    return (
      <label className="cell-edit color-cell">
        <span className="color-chip" style={{ background: valid ? value : 'transparent' }} />
        <input
          type="color"
          className="color-input"
          value={valid ? value : '#000000'}
          onChange={(e) => onCommit(e.target.value)}
          title={value || 'no color'}
        />
        <span className="color-hex">{value || '—'}</span>
      </label>
    )
  }

  if (!editing) {
    return (
      <div
        className="cell-edit cell-text"
        onDoubleClick={() => {
          setDraft(value)
          setEditing(true)
        }}
        title="Double-click to edit"
      >
        {value || <span className="cell-empty">—</span>}
      </div>
    )
  }

  return (
    <input
      className="cell-edit cell-input"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false)
        if (draft !== value) onCommit(draft)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          setEditing(false)
          if (draft !== value) onCommit(draft)
        } else if (e.key === 'Escape') {
          setEditing(false)
        }
      }}
    />
  )
}
