// ── HoT Companion — in-app pepper logo ──────────────────────────────────────
// Renders the same pixel-art icon as the app/Dock icon (via the shared
// iconArt.drawIcon) into a small canvas, recolored live to the active colorway.
// Also pushes the recolored icon to the macOS Dock (live + on next launch).

import { useEffect, useRef } from 'react'
import { useAtomValue } from 'jotai'
import { colorwayAtom } from '../state/atoms'
import { drawIcon, PALETTES } from '../lib/iconArt.mjs'

const CSS_SIZE = 34
const SCALE = 3 // retina crispness

export function PepperMark(): JSX.Element {
  const colorway = useAtomValue(colorwayAtom)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const palette = PALETTES[colorway] ?? PALETTES.omarchy
    const px = CSS_SIZE * SCALE
    ctx.clearRect(0, 0, px, px)
    drawIcon(ctx, px, palette)

    // Push a higher-res render to the macOS Dock (no-op elsewhere). Drawn on a
    // detached canvas so the small logo stays crisp at its own size.
    try {
      const big = document.createElement('canvas')
      big.width = big.height = 512
      const bctx = big.getContext('2d')
      if (bctx) {
        drawIcon(bctx, 512, palette)
        window.api.setDockIcon(big.toDataURL('image/png'))
      }
    } catch {
      /* dock icon is best-effort */
    }
  }, [colorway])

  return (
    <canvas
      ref={canvasRef}
      className="pepper-mark"
      width={CSS_SIZE * SCALE}
      height={CSS_SIZE * SCALE}
      style={{ width: CSS_SIZE, height: CSS_SIZE }}
      aria-hidden="true"
    />
  )
}
