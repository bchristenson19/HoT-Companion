# HoT Companion

A **bulk editor for [Bitfocus Companion](https://bitfocus.io/companion) config files**. Part of the HoT app suite — Electron + React + TypeScript + Jotai — with the pixel-art aesthetic inspired by the Omarchy Linux distro.

Companion's own editor edits one button at a time, which is painful for large, repetitive surfaces (think a 32×32 routing panel where every button differs only by an index). HoT Companion opens a `.companionconfig` export, lets you mass-edit hundreds of buttons in seconds, and writes a config you re-import into Companion.

> **Offline by design.** v1 edits exported config files; it does not talk to a
> running Companion instance. Companion's live HTTP API can only set button
> *styles* and trigger presses — it cannot edit actions/feedbacks or import a
> config — so the powerful bulk path is the file round-trip. (Live style-push is
> a possible future addition.)

## Features

- **Buttons** — a spreadsheet of every button across every page. Edit text, BG/FG color, font size, and alignment inline. Multi-select (click / ⌘-click / shift-range) and **fill** one value across the whole selection. Filter by page or free text.
- **Find & Replace** — scan string values in button text, action options, and feedback options; literal or regex; preview every match before applying. The fast way to swap a connection ID, IP, or variable that appears in dozens of buttons.
- **Templates** — capture a button (its style + steps/actions + feedbacks) and **stamp** it onto a selection. `{{n}}` / `{{row}}` / `{{col}}` / `{{page}}` tokens in any string are substituted per-target, so one template can fill a whole bank of incrementing buttons.

### Round-trip safety

The #1 guarantee: **fields the editor doesn't touch are preserved exactly.** The raw parsed export is the source of truth; edits mutate only targeted fields and the file is re-serialized in its original container (gzip or plain JSON). An open→save with no edits is semantically identical to the original. This is covered by an automated test (`npm test`).

## Develop

```bash
npm install
npm run dev
```

Open a config exported from **Companion → Settings → Import / Export → Export Full Configuration**.

## Test

```bash
npm test          # round-trip + transform unit tests (no Electron needed)
npm run typecheck
npm run lint
```

## Build

```bash
npm run icon          # generate resources/icon.png + icon.icns (pixel-art button bank)
npm run build         # compile main/preload/renderer → out/
npm run build:mac     # package a DMG + .app (also :win / :linux)
```

> **Environments where `node` is an Electron shim** (`ELECTRON_RUN_AS_NODE`):
> `npm run build:mac` fails — electron-builder's CLI mis-parses argv and
> Electron's `fs` intercepts `.asar` writes. Package via the programmatic API
> instead, with asar interception disabled:
>
> ```bash
> ELECTRON_NO_ASAR=1 node -e "process.noAsar=true; \
>   const {build,Platform,Arch}=require('electron-builder'); \
>   build({targets:Platform.MAC.createTarget(['dmg'],Arch.arm64)})"
> ```

The build is unsigned (internal tool) — first launch needs right-click → Open, or `xattr -dr com.apple.quarantine "HoT Companion.app"`.

## Architecture

```
src/
├── main/                  # Electron main process
│   ├── index.ts             # window + file-dialog IPC
│   ├── companion/
│   │   ├── codec.ts          # gunzip/gzip ↔ JSON (round-trip safe)
│   │   ├── model.ts          # read/write style fields across config versions
│   │   └── normalize.ts      # flatten controls → rows; replace; stamp (PURE)
│   ├── storage/store.ts      # settings + saved templates (userData JSON)
│   └── types.ts              # shared contract (main ↔ renderer)
├── preload/               # typed window.api bridge
└── renderer/              # React UI (Jotai state, pixel-art theme)
    └── src/components/       # ButtonsTab, ReplaceTab, TemplatesTab
```

`companion/model.ts` and `companion/normalize.ts` are **pure** (no Node/Electron
imports) so they run in both the main process (to build the initial view) and
the renderer (to apply edits to its in-memory copy before saving). Controls are
always addressed by `{page,row,column}` location, never by object pointer, so
edits survive the structured-clone that happens across the IPC boundary.

### Companion config shape (what we read/write)

A `.companionconfig` is gzipped JSON:

```
{ version, type:'full', companionBuild,
  pages:    { [page]: { name, gridSize, controls: { [row]: { [col]: control } } } },
  instances:{ [connectionId]: { moduleId, label, ... } },
  triggers, custom_variables, surfaces, imageLibrary, ...   ← preserved untouched
}
```

A button control carries `style` (flat `{text,size,color,bgcolor,alignment}` on
3.x, or `style.layers[]` on 4.x layered buttons), `steps{}.action_sets{down,up}`,
and `feedbacks[]`. The editor understands the style fields directly and treats
actions/feedbacks as find-replace / template payloads.
```
