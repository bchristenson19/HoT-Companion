// ── HoT Companion — preload bridge ──────────────────────────────────────────
// Exposes a typed, minimal window.api over contextBridge. The renderer never
// touches ipcRenderer directly.

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  RawConfig,
  OpenResult,
  SaveResult,
  AppSettings,
  ButtonTemplate,
} from '../main/types'

const api = {
  // File I/O
  openDialog: (): Promise<OpenResult> => ipcRenderer.invoke('cfg:open-dialog'),
  openPath: (path: string): Promise<OpenResult> => ipcRenderer.invoke('cfg:open-path', path),
  save: (path: string, raw: RawConfig): Promise<SaveResult> =>
    ipcRenderer.invoke('cfg:save', path, raw),
  saveAs: (suggestedName: string, raw: RawConfig): Promise<SaveResult> =>
    ipcRenderer.invoke('cfg:save-as', suggestedName, raw),

  // Settings + templates
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('store:get-settings'),
  getTemplates: (): Promise<ButtonTemplate[]> => ipcRenderer.invoke('store:get-templates'),
  saveTemplate: (tpl: ButtonTemplate): Promise<ButtonTemplate[]> =>
    ipcRenderer.invoke('store:save-template', tpl),
  deleteTemplate: (id: string): Promise<ButtonTemplate[]> =>
    ipcRenderer.invoke('store:delete-template', id),
}

export type CompanionApi = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // Context isolation off: define directly on the global (window at runtime).
  const w = globalThis as unknown as { electron: typeof electronAPI; api: typeof api }
  w.electron = electronAPI
  w.api = api
}
