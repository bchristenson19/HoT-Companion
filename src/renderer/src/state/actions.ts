// ── HoT Companion — action hooks ────────────────────────────────────────────
// Bridge the UI to the pure config logic (model/normalize) and the main-process
// file I/O (window.api). All mutations go through here so dirty-tracking and row
// re-derivation stay consistent.

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import {
  loadedAtom,
  rowsAtom,
  dirtyAtom,
  selectedIdsAtom,
  templatesAtom,
} from './atoms'
import { toastAtom } from './toast'
import type {
  ButtonRow,
  EditableField,
  ReplaceQuery,
  ReplaceMatch,
  ButtonTemplate,
  ControlLocation,
  RawConfig,
  LoadedConfig,
} from '@shared/types'
import { applyCellEdit, refreshRow, flatten, metaOf } from '@shared/companion/normalize'
import { previewReplace, applyReplace, captureControl, stampTemplate } from '@shared/companion/normalize'

let toastSeq = 0

export function useToast(): (text: string, isErr?: boolean) => void {
  const setToast = useSetAtom(toastAtom)
  return useCallback(
    (text: string, isErr = false) => setToast({ text, isErr, id: ++toastSeq }),
    [setToast],
  )
}

function locById(rows: ButtonRow[], id: string): ControlLocation | null {
  return rows.find((r) => r.id === id)?.loc ?? null
}

// ── Open / save ─────────────────────────────────────────────────────────────

export function useOpen(): () => Promise<void> {
  const setLoaded = useSetAtom(loadedAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const setSelected = useSetAtom(selectedIdsAtom)
  const toast = useToast()
  return useCallback(async () => {
    try {
      const { loaded } = await window.api.openDialog()
      if (!loaded) return
      setLoaded(loaded)
      setRows(loaded.rows)
      setSelected(new Set())
      setDirty(false)
      toast(`Opened ${loaded.fileName} — ${loaded.rows.length} buttons`)
    } catch (e) {
      toast((e as Error).message, true)
    }
  }, [setLoaded, setRows, setSelected, setDirty, toast])
}

export function useOpenPath(): (path: string) => Promise<void> {
  const setLoaded = useSetAtom(loadedAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const setSelected = useSetAtom(selectedIdsAtom)
  const toast = useToast()
  return useCallback(
    async (path: string) => {
      try {
        const { loaded } = await window.api.openPath(path)
        if (!loaded) return
        setLoaded(loaded)
        setRows(loaded.rows)
        setSelected(new Set())
        setDirty(false)
        toast(`Opened ${loaded.fileName} — ${loaded.rows.length} buttons`)
      } catch (e) {
        toast((e as Error).message, true)
      }
    },
    [setLoaded, setRows, setSelected, setDirty, toast],
  )
}

export function useSave(): (saveAs?: boolean) => Promise<void> {
  const [loaded, setLoaded] = useAtom(loadedAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const toast = useToast()
  return useCallback(
    async (saveAs = false) => {
      if (!loaded) return
      try {
        const res =
          saveAs || !loaded.path
            ? await window.api.saveAs(loaded.fileName, loaded.raw)
            : await window.api.save(loaded.path, loaded.raw)
        if (!res.path) return
        const fileName = res.path.split(/[/\\]/).pop() ?? loaded.fileName
        setLoaded({ ...loaded, path: res.path, fileName })
        setDirty(false)
        toast(`Saved ${fileName}`)
      } catch (e) {
        toast((e as Error).message, true)
      }
    },
    [loaded, setLoaded, setDirty, toast],
  )
}

export function useCreateNew(): () => void {
  const setLoaded = useSetAtom(loadedAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const setSelected = useSetAtom(selectedIdsAtom)
  return useCallback(() => {
    const raw: RawConfig = {
      version: null,
      type: 'full',
      companionBuild: null,
      pages: { '1': { name: 'Page 1', controls: {} } },
      instances: {},
      triggers: {},
      custom_variables: {},
      surfaces: {},
      imageLibrary: {},
    }
    const rows = flatten(raw)
    const loaded: LoadedConfig = {
      path: '',
      fileName: 'untitled.companionconfig',
      meta: metaOf(raw, rows.length),
      raw,
      rows,
      connections: {},
    }
    setLoaded(loaded)
    setRows(rows)
    setSelected(new Set())
    setDirty(true)
  }, [setLoaded, setRows, setSelected, setDirty])
}

// ── Cell edits ──────────────────────────────────────────────────────────────

/** Apply one value to a style field across many rows (multi-select / fill). */
export function useApplyEdit(): (ids: string[], field: EditableField, value: string) => void {
  const [loaded] = useAtom(loadedAtom)
  const [rows, setRows] = useAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const toast = useToast()
  return useCallback(
    (ids, field, value) => {
      if (!loaded) return
      let changed = 0
      const updated = new Map<string, ButtonRow>()
      for (const id of ids) {
        const loc = locById(rows, id)
        if (!loc) continue
        if (applyCellEdit(loaded.raw, loc, field, value)) {
          const fresh = refreshRow(loaded.raw, loc)
          if (fresh) {
            updated.set(id, fresh)
            changed++
          }
        }
      }
      if (changed === 0) {
        toast('No editable buttons in selection', true)
        return
      }
      setRows(rows.map((r) => updated.get(r.id) ?? r))
      setDirty(true)
      if (ids.length > 1) toast(`Set ${field} on ${changed} buttons`)
    },
    [loaded, rows, setRows, setDirty, toast],
  )
}

// ── Find & replace ──────────────────────────────────────────────────────────

export function usePreviewReplace(): (q: ReplaceQuery) => ReplaceMatch[] {
  const loaded = useAtomValue(loadedAtom)
  return useCallback((q) => (loaded ? previewReplace(loaded.raw, q) : []), [loaded])
}

export function useApplyReplace(): (q: ReplaceQuery) => void {
  const [loaded] = useAtom(loadedAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const toast = useToast()
  return useCallback(
    (q) => {
      if (!loaded) return
      const n = applyReplace(loaded.raw, q)
      if (n === 0) {
        toast('No matches replaced', true)
        return
      }
      setRows(flatten(loaded.raw))
      setDirty(true)
      toast(`Replaced ${n} value${n === 1 ? '' : 's'}`)
    },
    [loaded, setRows, setDirty, toast],
  )
}

// ── Templates ───────────────────────────────────────────────────────────────

export function useLoadTemplates(): () => Promise<void> {
  const setTemplates = useSetAtom(templatesAtom)
  return useCallback(async () => {
    setTemplates(await window.api.getTemplates())
  }, [setTemplates])
}

export function useCaptureTemplate(): (sourceId: string, name: string) => Promise<void> {
  const loaded = useAtomValue(loadedAtom)
  const rows = useAtomValue(rowsAtom)
  const setTemplates = useSetAtom(templatesAtom)
  const toast = useToast()
  return useCallback(
    async (sourceId, name) => {
      if (!loaded) return
      const loc = locById(rows, sourceId)
      if (!loc) return
      const control = captureControl(loaded.raw, loc)
      if (!control) {
        toast('Could not capture that button', true)
        return
      }
      const tpl: ButtonTemplate = {
        id: `tpl_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`,
        name: name || 'Untitled',
        control,
        created: new Date().toISOString(),
      }
      setTemplates(await window.api.saveTemplate(tpl))
      toast(`Saved template "${tpl.name}"`)
    },
    [loaded, rows, setTemplates, toast],
  )
}

export function useDeleteTemplate(): (id: string) => Promise<void> {
  const setTemplates = useSetAtom(templatesAtom)
  const toast = useToast()
  return useCallback(
    async (id) => {
      setTemplates(await window.api.deleteTemplate(id))
      toast('Template deleted')
    },
    [setTemplates, toast],
  )
}

export function useStampTemplate(): (tpl: ButtonTemplate, targetIds: string[]) => void {
  const [loaded] = useAtom(loadedAtom)
  const rows = useAtomValue(rowsAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const toast = useToast()
  return useCallback(
    (tpl, targetIds) => {
      if (!loaded) return
      const locs = targetIds.map((id) => locById(rows, id)).filter((l): l is ControlLocation => !!l)
      if (locs.length === 0) {
        toast('Select target buttons first', true)
        return
      }
      const n = stampTemplate(loaded.raw, tpl, locs)
      setRows(flatten(loaded.raw))
      setDirty(true)
      toast(`Stamped "${tpl.name}" onto ${n} button${n === 1 ? '' : 's'}`)
    },
    [loaded, rows, setRows, setDirty, toast],
  )
}

// metaOf re-exported for the header to recompute counts if needed.
export { metaOf }

// ── Button detail editing ───────────────────────────────────────────────────
// The DetailPanel calls buildDetail() directly on loaded.raw for rendering, and
// routes every mutation through useDetailEdit().run(fn). The callback receives
// the live raw config, performs an in-place mutation (from detail.ts), and
// returns true on success / a string error / void. The hook then refreshes the
// grid rows (so action/feedback counts update), marks the file dirty, and bumps
// a tick so the panel re-renders the freshly-mutated raw.

import { detailTickAtom } from './atoms'

export function useDetailEdit(): {
  raw: RawConfig | null
  run: (fn: (raw: RawConfig) => boolean | string | null | void, okMsg?: string) => void
} {
  const loaded = useAtomValue(loadedAtom)
  const setRows = useSetAtom(rowsAtom)
  const setDirty = useSetAtom(dirtyAtom)
  const setTick = useSetAtom(detailTickAtom)
  const toast = useToast()

  const run = useCallback(
    (fn: (raw: RawConfig) => boolean | string | null | void, okMsg?: string) => {
      if (!loaded) return
      // string = error message; null/true/undefined = success; false = no-op.
      const result = fn(loaded.raw)
      if (typeof result === 'string') {
        toast(result, true)
        return
      }
      if (result === false) {
        toast('Nothing changed', true)
        return
      }
      setRows(flatten(loaded.raw))
      setDirty(true)
      setTick((t) => t + 1)
      if (okMsg) toast(okMsg)
    },
    [loaded, setRows, setDirty, setTick, toast],
  )

  return { raw: loaded?.raw ?? null, run }
}
