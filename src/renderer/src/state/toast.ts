// ── HoT Companion — toast state ─────────────────────────────────────────────
// Minimal transient-message channel. Components push a message; the Toast
// component clears it after a timeout.

import { atom } from 'jotai'

export interface ToastMsg {
  text: string
  isErr: boolean
  /** Monotonic id so repeated identical messages still re-trigger the show. */
  id: number
}

export const toastAtom = atom<ToastMsg | null>(null)
