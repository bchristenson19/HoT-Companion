# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

HoT Companion is an Electron + React + TypeScript desktop app for bulk-editing [Bitfocus Companion](https://bitfocus.io/companion) config files (`.companionconfig`). It lets operators mass-edit hundreds of button configurations at once instead of one-by-one in Companion's native editor. It is **offline by design**: it edits exported config files and does not talk to a running Companion instance.

## Commands

```bash
npm run dev          # Launch dev app with hot reload (Vite + Electron)
npm test             # Run unit tests (no Electron needed)
npm run typecheck    # Full TypeScript check (runs typecheck:node then typecheck:web)
npm run lint         # Lint all .ts/.tsx files (eslint . --ext .ts,.tsx)
npm run build        # Compile all three Vite targets → out/
npm run build:mac    # Package DMG + .app for macOS (also :win / :linux)
npm run icon         # Regenerate pixel-art icon resources (icon.png + icon.icns)
```

To run a single test by name: `node --import tsx --test --test-name-pattern="<pattern>" test/*.test.ts`

The test suite imports the pure `codec`/`model`/`normalize`/`detail` modules directly — no Electron, no build step. `test/roundtrip.test.ts` is also the **executable spec** for the 3.x/4.x format invariants below; read its fixture before changing any pure module.

## Architecture

The app has three Vite build targets (configured in `electron.vite.config.ts`):

- **main** (`src/main/`) — Electron main process: file I/O, IPC handlers, template storage, macOS Dock icon recoloring
- **preload** (`src/preload/`) — Typed `window.api` contextBridge (sandbox-safe IPC contract)
- **renderer** (`src/renderer/`) — React + Jotai UI

### The "Pure" Layer — `src/main/companion/`

This is the most important directory. These modules have **no Node/Electron imports**, so they run identically in both the main process (to build the initial view) and the renderer (to apply edits to its in-memory copy before saving):

- `codec.ts` — gunzip↔gzip, detects container format from magic bytes `0x1f 0x8b` (`parseBuffer`/`serializeConfig`; `readConfigFile`/`writeConfigFile` are the thin fs wrappers used only by main)
- `model.ts` — reads/writes style fields for both Companion 3.x (flat `style` object) and 4.x (layered `style.layers[]`)
- `normalize.ts` — flattens raw config controls into `ButtonRow[]`; hosts `applyCellEdit`, `refreshRow`, `previewReplace`, `applyReplace`, `captureControl`, `stampTemplate`
- `detail.ts` — reads/edits a button's actions and feedbacks (`buildDetail` + the `set*`/`add*`/`remove*`/`move*`/`duplicate*`/`replace*Raw` mutators)

The IPC contract (shared types) lives in `src/main/types.ts`.

### Data Flow

1. **Open:** main `readConfigFile()` → `parseBuffer()` → `normalize.flatten()` → renderer receives `LoadedConfig` (raw config + flat `ButtonRow[]` + connection labels)
2. **Edit:** renderer calls pure functions locally (`applyCellEdit`, `applyReplace`, `stampTemplate`, and the `detail.ts` mutators) to mutate `loaded.raw` **in place** → re-derives affected rows via `refreshRow`/`flatten`, sets `dirtyAtom`, and bumps `detailTickAtom` to force the detail panel to re-render off the mutated raw
3. **Save:** renderer sends the mutated `raw` back to main → `writeConfigFile()` re-serializes in the original container format

**Gzip format is tracked main-side, not in the document.** `LoadedConfig` carries no compression flag. The main process remembers `gzipped` per absolute path in the `gzipByPath` Map (`src/main/index.ts`) and writes back in that format. Unknown paths (Save As, new files) default to **gzip**, which is what Companion 4.x imports.

All renderer↔main mutation hooks live in `src/renderer/src/state/actions.ts` (`useOpen`, `useSave`, `useApplyEdit`, `useApplyReplace`, `useStampTemplate`, `useDetailEdit`). Every mutation routes through here so dirty-tracking and row re-derivation stay consistent — don't mutate `raw` from components directly.

### State Management

Renderer state (`src/renderer/src/state/`) uses Jotai atoms:
- `atoms.ts` — config, grid selection, filters, colorway (colorway persisted to `localStorage`), `dirtyAtom`, `detailTickAtom`
- `actions.ts` — the `use*` hooks that coordinate atoms + IPC calls
- `toast.ts` — toast atom + `useToast`

### Path Aliases

| Alias | Resolves to | Available in |
|---|---|---|
| `@main/*` | `src/main/*` | main |
| `@renderer/*` | `src/renderer/src/*` | renderer |
| `@shared/*` | `src/main/*` (pure logic, usable in renderer too) | renderer |
| `@resources/*` | `resources/*` | renderer |

## Key Invariants

**Round-trip safety is the #1 constraint.** Fields the editor doesn't touch must survive byte-identical through open → edit → save. This is tested automatically in `test/roundtrip.test.ts`.

**The raw parsed config is the source of truth.** Edits mutate only targeted fields; everything else (triggers, surfaces, imageLibrary, custom_variables, etc.) passes through untouched.

**Controls / actions / feedbacks are always addressed by position**, never by object reference — a control by `{page, row, column}`, an action by `{loc, stepId, setKey, index}`, a feedback by `{loc, index}`. Positional addressing survives structured-clone across the IPC boundary and serialization round-trips.

**Representations are preserved, not normalized.** The 3.x/4.x split runs deep and the pure layer keeps each value in the form it was read:
- Colors round-trip in their original encoding — integer (`0xff0000`) stays integer, `#rrggbb` stays hex string, `rgb(r, g, b)` stays `rgb()`. The UI always works in `#rrggbb`; `model.ts` converts on read/write.
- Actions key their connection as `connectionId` (4.x) **or** `instance` (3.x), and their type as `actionId` (4.x) **or** `action` (3.x). Mutators must write back to whichever key already exists, never add the other.

The grid edits only style fields (`text`, `bgcolor`, `color`, `size`, `alignment` — `EditableField`). Everything else is changed via find & replace, templates, or the per-item raw-JSON escape hatch.

## Companion Config Format

```
.companionconfig = gzipped JSON  (or plain JSON for older exports)
{
  version, type: 'full', companionBuild,
  pages: {
    [pageNum]: {
      name, gridSize,
      controls: { [row]: { [col]: { type, style, steps, feedbacks, options } } }
    }
  },
  instances, triggers, custom_variables, surfaces, imageLibrary  ← preserved untouched
}

Style — two formats:
  3.x: style = { text, size, color, bgcolor, alignment }  (flat)
  4.x: style.layers = [ { type: 'fill'|'text', ...fields } ]  (layered)

A button control also carries steps{}.action_sets{down,up,rotate} and feedbacks[].
Navigation controls (pageup/pagedown/pagenum) have no editable style/steps.
```

## Packaging Notes

The app is **unsigned** — on first macOS launch users must right-click → Open or run:
```bash
xattr -dr com.apple.quarantine "HoT Companion.app"
```

App ID: `com.hot.companion`. Apple Silicon (arm64) only. No auto-update (internal tool).

**`build:mac` fails when `node` is an Electron shim** (`ELECTRON_RUN_AS_NODE` set): electron-builder's CLI mis-parses argv and Electron's `fs` intercepts `.asar` writes. Package via the programmatic API with asar interception disabled:
```bash
ELECTRON_NO_ASAR=1 node -e "process.noAsar=true; \
  const {build,Platform,Arch}=require('electron-builder'); \
  build({targets:Platform.MAC.createTarget(['dmg'],Arch.arm64)})"
```
