// ── HoT Companion — config codec ────────────────────────────────────────────
// Read/write Bitfocus Companion export files. Companion 4.x exports are gzipped
// JSON; older/alternate exports may be plain JSON. We auto-detect on read and
// preserve the original container format on write so an unchanged open→save is
// semantically identical (round-trip safety is the #1 requirement of this app).

import { gunzipSync, gzipSync } from 'zlib'
import { readFileSync, writeFileSync } from 'fs'
import type { RawConfig } from '../types'

/** gzip magic bytes: 0x1f 0x8b. */
function isGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b
}

export interface ParsedConfig {
  raw: RawConfig
  /** Whether the source file was gzip-compressed (preserved on write). */
  gzipped: boolean
}

/** Parse a Companion export buffer into a raw object + remember its format. */
export function parseBuffer(buf: Buffer): ParsedConfig {
  const gzipped = isGzip(buf)
  const jsonText = gzipped ? gunzipSync(buf).toString('utf-8') : buf.toString('utf-8')
  const raw = JSON.parse(jsonText) as RawConfig
  return { raw, gzipped }
}

/** Serialize a raw object back to a buffer in the requested container format.
 *  Uses 2-space JSON like Companion's own exporter; gzip level 9 to match the
 *  compact files Companion produces (exact bytes need not match — Companion
 *  re-parses on import — but content must be loss-free). */
export function serializeConfig(raw: RawConfig, gzipped: boolean): Buffer {
  const jsonText = JSON.stringify(raw, null, '\t')
  const jsonBuf = Buffer.from(jsonText, 'utf-8')
  return gzipped ? gzipSync(jsonBuf, { level: 9 }) : jsonBuf
}

/** Read + parse a file from disk. */
export function readConfigFile(path: string): ParsedConfig {
  return parseBuffer(readFileSync(path))
}

/** Serialize + write a file to disk in the given container format. */
export function writeConfigFile(path: string, raw: RawConfig, gzipped: boolean): void {
  writeFileSync(path, serializeConfig(raw, gzipped))
}
