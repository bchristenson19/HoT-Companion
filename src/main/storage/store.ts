// ── HoT Companion — persistent store ────────────────────────────────────────
// A tiny JSON file in userData. Holds app settings (recent files, last dir) and
// the operator's saved button templates. The edited .companionconfig files
// themselves live on disk wherever the user keeps them — only metadata and
// reusable templates are persisted here.

import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppSettings, ButtonTemplate } from '@main/types'
import { log } from '@main/logger'

interface StoreShape {
  settings: AppSettings
  templates: ButtonTemplate[]
}

const DEFAULT: StoreShape = {
  settings: { recentFiles: [], lastDir: '' },
  templates: [],
}

function file(): string {
  return join(app.getPath('userData'), 'companion-store.json')
}

let cache: StoreShape | null = null

function read(): StoreShape {
  if (cache) return cache
  let next: StoreShape
  try {
    const raw = readFileSync(file(), 'utf-8')
    const parsed = JSON.parse(raw)
    next = {
      settings: { ...DEFAULT.settings, ...(parsed.settings ?? {}) },
      templates: Array.isArray(parsed.templates) ? parsed.templates : [],
    }
  } catch {
    next = { settings: { ...DEFAULT.settings }, templates: [] }
  }
  cache = next
  return next
}

function write(): void {
  if (!cache) return
  try {
    writeFileSync(file(), JSON.stringify(cache, null, 2))
  } catch (e) {
    log('store write failed:', (e as Error).message)
  }
}

// ── Settings ──────────────────────────────────────────────────────────────

export function getSettings(): AppSettings {
  return read().settings
}

const MAX_RECENT = 10

export function noteRecentFile(path: string): AppSettings {
  const s = read()
  const recent = [path, ...s.settings.recentFiles.filter((p) => p !== path)].slice(0, MAX_RECENT)
  s.settings = { recentFiles: recent, lastDir: dirname(path) }
  write()
  return s.settings
}

function dirname(p: string): string {
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return i >= 0 ? p.slice(0, i) : ''
}

// ── Templates ─────────────────────────────────────────────────────────────

export function getTemplates(): ButtonTemplate[] {
  return read().templates
}

export function saveTemplate(tpl: ButtonTemplate): ButtonTemplate[] {
  const s = read()
  const idx = s.templates.findIndex((t) => t.id === tpl.id)
  if (idx >= 0) s.templates[idx] = tpl
  else s.templates.push(tpl)
  write()
  return s.templates
}

export function deleteTemplate(id: string): ButtonTemplate[] {
  const s = read()
  s.templates = s.templates.filter((t) => t.id !== id)
  write()
  return s.templates
}
