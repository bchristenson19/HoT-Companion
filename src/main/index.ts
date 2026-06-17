// ── HoT Companion — main process entry ──────────────────────────────────────
// Owns the BrowserWindow and all file I/O. The renderer holds the raw config in
// memory and sends it back when saving; the main process only opens/saves files
// and persists templates + recent-file metadata.

import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { basename, join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type {
  RawConfig,
  LoadedConfig,
  OpenResult,
  SaveResult,
  AppSettings,
  ButtonTemplate,
} from '@main/types'
import { readConfigFile, writeConfigFile } from '@main/companion/codec'
import { flatten, metaOf, connectionLabels } from '@main/companion/normalize'
import {
  getSettings,
  noteRecentFile,
  getTemplates,
  saveTemplate,
  deleteTemplate,
} from '@main/storage/store'
import { log } from '@main/logger'

// The codec must remember whether a file was gzipped so we can write it back in
// the same container. Keyed by absolute path.
const gzipByPath = new Map<string, boolean>()

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 600,
    show: false,
    backgroundColor: '#14111a',
    autoHideMenuBar: true,
    title: 'HoT Companion',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
    },
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Load helpers ────────────────────────────────────────────────────────────

function loadFromPath(path: string): LoadedConfig {
  const { raw, gzipped } = readConfigFile(path)
  gzipByPath.set(path, gzipped)
  const rows = flatten(raw)
  const loaded: LoadedConfig = {
    path,
    fileName: basename(path),
    meta: metaOf(raw, rows.length),
    raw,
    rows,
    connections: connectionLabels(raw),
  }
  noteRecentFile(path)
  log('opened', path, `(${rows.length} buttons, gzip=${gzipped})`)
  return loaded
}

// ── IPC ───────────────────────────────────────────────────────────────────

function registerIpc(): void {
  // Open via dialog
  ipcMain.handle('cfg:open-dialog', async (): Promise<OpenResult> => {
    const settings = getSettings()
    const res = await dialog.showOpenDialog({
      title: 'Open Companion config',
      defaultPath: settings.lastDir || undefined,
      properties: ['openFile'],
      filters: [
        { name: 'Companion config', extensions: ['companionconfig', 'json', 'gz'] },
        { name: 'All files', extensions: ['*'] },
      ],
    })
    if (res.canceled || !res.filePaths[0]) return { loaded: null }
    return { loaded: loadFromPath(res.filePaths[0]) }
  })

  // Open a known path (recent files)
  ipcMain.handle('cfg:open-path', async (_e, path: string): Promise<OpenResult> => {
    try {
      return { loaded: loadFromPath(path) }
    } catch (err) {
      log('open-path failed', path, (err as Error).message)
      throw new Error(`Could not open ${basename(path)}: ${(err as Error).message}`)
    }
  })

  // Save back to the same file
  ipcMain.handle('cfg:save', async (_e, path: string, raw: RawConfig): Promise<SaveResult> => {
    const gzipped = gzipByPath.get(path) ?? true
    writeConfigFile(path, raw, gzipped)
    noteRecentFile(path)
    log('saved', path, `(gzip=${gzipped})`)
    return { path }
  })

  // Save As
  ipcMain.handle(
    'cfg:save-as',
    async (_e, suggestedName: string, raw: RawConfig): Promise<SaveResult> => {
      const settings = getSettings()
      const res = await dialog.showSaveDialog({
        title: 'Export Companion config',
        defaultPath: settings.lastDir ? `${settings.lastDir}/${suggestedName}` : suggestedName,
        filters: [{ name: 'Companion config', extensions: ['companionconfig'] }],
      })
      if (res.canceled || !res.filePath) return { path: null }
      // New files default to gzip (what Companion 4.x imports).
      const gzipped = gzipByPath.get(res.filePath) ?? true
      gzipByPath.set(res.filePath, gzipped)
      writeConfigFile(res.filePath, raw, gzipped)
      noteRecentFile(res.filePath)
      log('saved-as', res.filePath, `(gzip=${gzipped})`)
      return { path: res.filePath }
    },
  )

  // Settings + templates
  ipcMain.handle('store:get-settings', (): AppSettings => getSettings())
  ipcMain.handle('store:get-templates', (): ButtonTemplate[] => getTemplates())
  ipcMain.handle('store:save-template', (_e, tpl: ButtonTemplate) => saveTemplate(tpl))
  ipcMain.handle('store:delete-template', (_e, id: string) => deleteTemplate(id))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.hot.companion')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  createWindow()
  log('HoT Companion ready')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
