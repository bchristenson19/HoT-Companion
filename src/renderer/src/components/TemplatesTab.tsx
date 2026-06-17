// ── HoT Companion — Templates ───────────────────────────────────────────────
// Capture a button (its style + steps/actions + feedbacks) as a reusable
// template, then stamp it onto the current grid selection. String values
// support {{n}} (1-based stamp index), {{row}}, {{col}}, {{page}} tokens so a
// single template can fill a whole bank of incrementing buttons.

import { useAtomValue } from 'jotai'
import { useState } from 'react'
import { selectedIdsAtom, rowsAtom, templatesAtom } from '../state/atoms'
import {
  useCaptureTemplate,
  useDeleteTemplate,
  useStampTemplate,
} from '../state/actions'
import { ICON, friendlyType } from '../lib/glyphs'
import type { ButtonTemplate } from '@shared/types'

export function TemplatesTab(): JSX.Element {
  const templates = useAtomValue(templatesAtom)
  const selected = useAtomValue(selectedIdsAtom)
  const rows = useAtomValue(rowsAtom)
  const capture = useCaptureTemplate()
  const remove = useDeleteTemplate()
  const stamp = useStampTemplate()

  const selectedIds = [...selected]
  const [captureName, setCaptureName] = useState('')

  const singleSelected = selectedIds.length === 1 ? selectedIds[0] : null
  const selectedLabel = singleSelected
    ? rows.find((r) => r.id === singleSelected)?.text || singleSelected
    : null

  return (
    <div className="templates-tab">
      <div className="tpl-capture">
        <h4>
          <span className="col-icon">{ICON.capture}</span> Save a button as a template
        </h4>
        {singleSelected ? (
          <div className="capture-form">
            <p className="tpl-hint">
              Copying button <code>{singleSelected}</code>
              {selectedLabel ? ` (“${selectedLabel}”)` : ''} — its look, actions, and status
              lights.
            </p>
            <input
              className="input"
              placeholder="Name this template"
              value={captureName}
              onChange={(e) => setCaptureName(e.target.value)}
            />
            <button
              className="btn"
              disabled={!captureName.trim()}
              onClick={() => {
                capture(singleSelected, captureName.trim())
                setCaptureName('')
              }}
            >
              <span className="btn-icon">{ICON.capture}</span> Save template
            </button>
          </div>
        ) : (
          <p className="tpl-hint">
            Pick <strong>one</strong> button in the Buttons tab, then come back here to save it
            as a reusable template.
          </p>
        )}
      </div>

      <div className="tpl-list-wrap">
        <h4>
          <span className="col-icon">{ICON.templates}</span> Your templates ({templates.length})
        </h4>
        <p className="tpl-hint">
          Select buttons in the Buttons tab, then <strong>Stamp</strong> a template onto all of
          them at once. Currently {selectedIds.length} selected.
        </p>
        <p className="tpl-hint">
          {ICON.tip} Auto-numbering: put <code>{'{{n}}'}</code> in the label or settings and the
          1st button gets 1, the 2nd gets 2, and so on. Also: <code>{'{{row}}'}</code>,{' '}
          <code>{'{{col}}'}</code>, <code>{'{{page}}'}</code>.
        </p>
        {templates.length === 0 ? (
          <div className="tpl-empty">No templates yet — save one from a button to get started.</div>
        ) : (
          <div className="tpl-list">
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                tpl={t}
                canStamp={selectedIds.length > 0}
                onStamp={() => stamp(t, selectedIds)}
                onDelete={() => remove(t.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TemplateCard({
  tpl,
  canStamp,
  onStamp,
  onDelete,
}: {
  tpl: ButtonTemplate
  canStamp: boolean
  onStamp: () => void
  onDelete: () => void
}): JSX.Element {
  const type = typeof tpl.control?.type === 'string' ? friendlyType(tpl.control.type) : '—'
  return (
    <div className="tpl-card">
      <div className="tpl-card-head">
        <span className="tpl-name">{tpl.name}</span>
        <span className="tpl-type">{type}</span>
      </div>
      <div className="tpl-card-actions">
        <button
          className="btn"
          disabled={!canStamp}
          onClick={onStamp}
          title={canStamp ? 'Apply this template to the selected buttons' : 'Select buttons first'}
        >
          <span className="btn-icon">{ICON.stamp}</span> Stamp
        </button>
        <button className="btn ghost" onClick={onDelete} title="Delete this template">
          <span className="btn-icon">{ICON.trash}</span> Delete
        </button>
      </div>
    </div>
  )
}
