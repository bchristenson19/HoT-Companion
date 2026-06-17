// ── HoT Companion — toast ───────────────────────────────────────────────────

import { useAtom } from 'jotai'
import { useEffect, useState } from 'react'
import { toastAtom } from '../state/toast'

export function Toast(): JSX.Element | null {
  const [toast] = useAtom(toastAtom)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!toast) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div className={`toast ${toast.isErr ? 'err' : ''} ${visible ? 'show' : ''}`}>
      {toast.text}
    </div>
  )
}
