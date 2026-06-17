// ── HoT Companion — file logger ─────────────────────────────────────────────
// Appends timestamped lines to userData/app.log, mirrored to the console.

import { app } from 'electron'
import { appendFileSync } from 'fs'
import { join } from 'path'

function logPath(): string {
  try {
    return join(app.getPath('userData'), 'app.log')
  } catch {
    return 'app.log'
  }
}

export function log(...parts: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${parts.map(String).join(' ')}`
  // eslint-disable-next-line no-console
  console.log(line)
  try {
    appendFileSync(logPath(), line + '\n')
  } catch {
    // logging must never throw
  }
}
