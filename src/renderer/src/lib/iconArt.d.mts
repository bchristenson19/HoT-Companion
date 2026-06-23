// Type declarations for the shared plain-JS icon-art module (iconArt.mjs).
// Kept as JS so the Node build script and Vite renderer share one definition;
// these types let the renderer import it with full checking.

export type IconPalette = Record<string, string>

export const PEPPER: string[]
export const PALETTES: Record<string, IconPalette>
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  size: number,
  palette: IconPalette,
): void
