// ── HoT Companion — Find & Replace ──────────────────────────────────────────
// Scan string values across button style / action options / feedback options
// and bulk-replace them. Primary use: swap a connectionId / IP / variable that
// appears in many buttons at once. Always previews matches before applying.

import { useAtomValue } from 'jotai'
import { useMemo, useState } from 'react'
import { selectedIdsAtom } from '../state/atoms'
import { usePreviewReplace, useApplyReplace } from '../state/actions'
import { ICON } from '../lib/glyphs'
import type { ReplaceQuery, ReplaceScope } from '@shared/types'

const SCOPES: { key: ReplaceScope; label: string }[] = [
  { key: 'all', label: 'Everywhere' },
  { key: 'text', label: 'Button labels' },
  { key: 'actionOptions', label: 'What buttons do (actions)' },
  { key: 'feedbackOptions', label: 'Status-light settings (feedbacks)' },
]

export function ReplaceTab(): JSX.Element {
  const selected = useAtomValue(selectedIdsAtom)
  const preview = usePreviewReplace()
  const apply = useApplyReplace()

  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  const [scope, setScope] = useState<ReplaceScope>('all')
  const [regex, setRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [selectionOnly, setSelectionOnly] = useState(false)

  const query: ReplaceQuery = useMemo(
    () => ({
      find,
      replace,
      scope,
      regex,
      caseSensitive,
      onlyIds: selectionOnly ? [...selected] : undefined,
    }),
    [find, replace, scope, regex, caseSensitive, selectionOnly, selected],
  )

  const matches = useMemo(() => {
    try {
      return preview(query)
    } catch {
      return [] // invalid regex while typing — silently show nothing
    }
  }, [preview, query])

  const regexError = useMemo(() => {
    if (!regex || !find) return null
    try {
      new RegExp(find)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }, [regex, find])

  return (
    <div className="replace-tab">
      <div className="replace-form">
        <div className="hint">
          <span className="hint-icon">{ICON.tip}</span>
          <span>Search and swap text across many buttons at once — preview before you apply.</span>
        </div>

        <label className="field-label">Find</label>
        <input className="input" value={find} onChange={(e) => setFind(e.target.value)} autoFocus />

        <label className="field-label">Replace with</label>
        <input className="input" value={replace} onChange={(e) => setReplace(e.target.value)} />

        <label className="field-label">Where to look</label>
        <select
          className="input"
          value={scope}
          onChange={(e) => setScope(e.target.value as ReplaceScope)}
          title="Which part of each button to search in"
        >
          {SCOPES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="replace-opts">
          <label className="check-row">
            <input type="checkbox" checked={regex} onChange={(e) => setRegex(e.target.checked)} />
            Regex
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            Case sensitive
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={selectionOnly}
              onChange={(e) => setSelectionOnly(e.target.checked)}
              disabled={selected.size === 0}
            />
            Only selected buttons ({selected.size})
          </label>
        </div>

        {regexError && <div className="form-error">Invalid regex: {regexError}</div>}

        <button
          className="btn replace-apply"
          disabled={!find || matches.length === 0}
          onClick={() => apply(query)}
        >
          Replace {matches.length} match{matches.length === 1 ? '' : 'es'}
        </button>
      </div>

      <div className="replace-preview">
        <h4>Preview {matches.length > 0 && `(${matches.length})`}</h4>
        {!find ? (
          <div className="preview-hint">Type something in “Find” to see what will change.</div>
        ) : matches.length === 0 ? (
          <div className="preview-hint">Nothing matches “{find}” yet.</div>
        ) : (
          <div className="match-list">
            {matches.slice(0, 300).map((m, i) => (
              <div className="match-row" key={`${m.id}-${i}`}>
                <div className="match-where">
                  <span className="match-id">{m.id}</span>
                  <span className="match-path">{m.where}</span>
                </div>
                <div className="match-diff">
                  <span className="match-before">{m.before}</span>
                  <span className="match-arrow">→</span>
                  <span className="match-after">{m.after}</span>
                </div>
              </div>
            ))}
            {matches.length > 300 && (
              <div className="preview-hint">…and {matches.length - 300} more (all will be replaced).</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
