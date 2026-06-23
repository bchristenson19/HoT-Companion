// ── HoT Companion — app shell ───────────────────────────────────────────────
// Topbar (wordmark + open/save + file info), tab strip, and the active tab.
// Loads saved templates on mount; warns before discarding unsaved edits.

import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import {
  tabAtom,
  loadedAtom,
  dirtyAtom,
  hasConfigAtom,
  colorwayAtom,
} from './state/atoms'
import { useOpen, useSave, useLoadTemplates, useCreateNew } from './state/actions'
import { ButtonsTab } from './components/ButtonsTab'
import { ReplaceTab } from './components/ReplaceTab'
import { TemplatesTab } from './components/TemplatesTab'
import { Toast } from './components/Toast'
import { PepperMark } from './components/PepperMark'
import { ICON } from './lib/glyphs'
import { COLORWAYS } from './lib/colorways'
import type { Tab } from './state/atoms'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'buttons', label: 'Buttons', icon: ICON.buttons },
  { key: 'replace', label: 'Find & Replace', icon: ICON.replace },
  { key: 'templates', label: 'Templates', icon: ICON.templates },
]

export function App(): JSX.Element {
  const [tab, setTab] = useAtom(tabAtom)
  const loaded = useAtomValue(loadedAtom)
  const dirty = useAtomValue(dirtyAtom)
  const hasConfig = useAtomValue(hasConfigAtom)
  const [colorway, setColorway] = useAtom(colorwayAtom)
  const open = useOpen()
  const save = useSave()
  const createNew = useCreateNew()
  const loadTemplates = useLoadTemplates()

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // Apply the active colorway to <html> so theme.css overrides take effect.
  useEffect(() => {
    document.documentElement.setAttribute('data-colorway', colorway)
  }, [colorway])

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">
          <PepperMark />
          <span className="hot">HoT</span> COMPANION
          <span className="model">BULK</span>
        </div>

        <div className="file-bar">
          <button className="btn ghost" onClick={createNew} title="Start a new blank config">
            <span className="btn-icon">{ICON.new}</span> New
          </button>
          <button className="btn" onClick={open} title="Open a .companionconfig file you exported from Companion">
            <span className="btn-icon">{ICON.open}</span> Open
          </button>
          <button
            className="btn"
            onClick={() => save(false)}
            disabled={!hasConfig || !dirty}
            title="Save your changes back to the same file"
          >
            <span className="btn-icon">{ICON.save}</span> Save
          </button>
          <button
            className="btn ghost"
            onClick={() => save(true)}
            disabled={!hasConfig}
            title="Save to a new file"
          >
            <span className="btn-icon">{ICON.saveAs}</span> Save As
          </button>
        </div>

        <div className="spacer" />

        <div className="file-info">
          {loaded ? (
            <>
              <span className="file-name">
                {loaded.fileName}
                {dirty && (
                  <span className="dirty-dot" title="You have unsaved changes">
                    {ICON.dirty}
                  </span>
                )}
              </span>
              <span className="file-meta">
                {loaded.meta.buttonCount} buttons · {loaded.meta.pageCount} pages
                {loaded.meta.version != null && ` · v${loaded.meta.version}`}
              </span>
            </>
          ) : (
            <span className="file-meta">No file open</span>
          )}
        </div>

        <div className="colorways" title="App color theme">
          {COLORWAYS.map((c) => (
            <button
              key={c.key}
              className={`colorway-btn ${colorway === c.key ? 'active' : ''}`}
              onClick={() => setColorway(c.key)}
              title={c.name}
              aria-label={`${c.name} theme`}
            >
              <span className="cw-swatches">
                <span style={{ background: c.swatch[0] }} />
                <span style={{ background: c.swatch[1] }} />
                <span style={{ background: c.swatch[2] }} />
              </span>
              <span className="cw-name">{c.name}</span>
            </button>
          ))}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
            disabled={t.key !== 'buttons' && !hasConfig}
          >
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="body">
        {!hasConfig ? (
          <EmptyState onOpen={open} onNew={createNew} />
        ) : (
          <>
            {tab === 'buttons' && <ButtonsTab />}
            {tab === 'replace' && <ReplaceTab />}
            {tab === 'templates' && <TemplatesTab />}
          </>
        )}
      </main>

      <Toast />
    </div>
  )
}

function EmptyState({ onOpen, onNew }: { onOpen: () => void; onNew: () => void }): JSX.Element {
  return (
    <div className="empty-state">
      <div className="welcome-card">
        <div className="welcome-icon">{ICON.buttons}</div>
        <h2 className="welcome-title">Bulk-edit your Companion buttons</h2>
        <p className="welcome-sub">
          Start from scratch or open a config you exported from Companion, change lots of buttons
          at once, then import it back.
        </p>

        <ol className="welcome-steps">
          <li className="step">
            <span className="step-icon">{ICON.open}</span>
            <span className="step-text">
              <strong>Open</strong> your exported config, or start a <strong>new</strong> blank one
            </span>
          </li>
          <li className="step">
            <span className="step-icon">{ICON.fg}</span>
            <span className="step-text">
              <strong>Edit in bulk</strong> — labels, colors, find &amp; replace, templates
            </span>
          </li>
          <li className="step">
            <span className="step-icon">{ICON.saveAs}</span>
            <span className="step-text">
              <strong>Save</strong> and re-import into Companion
            </span>
          </li>
        </ol>

        <div className="welcome-actions">
          <button className="btn welcome-open" onClick={onNew}>
            <span className="btn-icon">{ICON.new}</span> Start from scratch
          </button>
          <button className="btn ghost welcome-open" onClick={onOpen}>
            <span className="btn-icon">{ICON.open}</span> Open existing file
          </button>
        </div>

        <p className="welcome-hint">
          {ICON.tip} In Companion: Settings → Import / Export → Export Full Configuration
        </p>
      </div>
    </div>
  )
}
