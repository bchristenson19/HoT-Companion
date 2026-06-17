// ── HoT Companion — round-trip & transform tests ────────────────────────────
// Run with: npm test  (node --import tsx --test). No Electron needed — these
// import the pure codec/model/normalize modules directly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseBuffer, serializeConfig } from '../src/main/companion/codec'
import {
  flatten,
  metaOf,
  connectionLabels,
  applyCellEdit,
  controlAt,
  previewReplace,
  applyReplace,
  captureControl,
  stampTemplate,
} from '../src/main/companion/normalize'
import { getField } from '../src/main/companion/model'
import type { ControlLocation, ButtonTemplate } from '../src/main/types'

// ── Fixture: a config exercising both control formats + unknown fields ───────
function fixture(): any {
  return {
    version: 8,
    type: 'full',
    companionBuild: '4.3.4+test',
    // An unknown top-level key that MUST survive a round-trip untouched.
    surfaces: { 'streamdeck-1': { name: 'Front', _opaque: [1, 2, 3] } },
    custom_variables: { my_var: { defaultValue: 'x' } },
    instances: {
      conn_kumo: { moduleId: 'aja-kumo', label: 'KUMO', sortOrder: 0 },
      conn_atem: { moduleId: 'bmd-atem', label: 'ATEM', sortOrder: 1 },
    },
    pages: {
      '1': {
        name: 'Cameras',
        gridSize: { minColumn: 0, maxColumn: 7, minRow: 0, maxRow: 3 },
        controls: {
          '0': {
            // 4.x layered button.
            '0': {
              type: 'button-layered',
              options: { stepProgression: 'auto', rotaryActions: false },
              style: {
                layers: [
                  { type: 'fill', bgcolor: 0x000000 },
                  { type: 'text', text: 'CAM 1', size: 14, color: 0xffffff, alignment: 'center:center' },
                ],
              },
              steps: {
                '0': {
                  action_sets: {
                    down: [
                      {
                        id: 'a1',
                        connectionId: 'conn_kumo',
                        actionId: 'route',
                        options: { src: '1', dst: '1', note: 'route SRC 1' },
                      },
                    ],
                    up: [],
                  },
                  options: {},
                },
              },
              feedbacks: [
                {
                  id: 'f1',
                  connectionId: 'conn_atem',
                  feedbackId: 'tally',
                  options: { input: '1' },
                  style: { bgcolor: 0xff0000 },
                },
              ],
            },
            // 3.x flat-style button (string colors).
            '1': {
              type: 'button',
              style: {
                text: 'CAM 2',
                size: 'auto',
                color: 'rgb(255, 255, 255)',
                bgcolor: '#102030',
                alignment: 'center:top',
              },
              steps: {
                '0': {
                  action_sets: {
                    down: [
                      { id: 'a2', instance: 'conn_kumo', action: 'route', options: { src: '2', dst: '1' } },
                    ],
                  },
                },
              },
              feedbacks: [],
            },
          },
          '1': {
            // A navigation control — no editable style.
            '0': { type: 'pageup' },
          },
        },
      },
    },
  }
}

function loc(page: number, row: number, column: number): ControlLocation {
  return { page, row, column, pageName: '' }
}

// ── Tests ────────────────────────────────────────────────────────────────

test('gzip round-trip: serialize→parse is loss-free and gzip detected', () => {
  const raw = fixture()
  const buf = serializeConfig(raw, true)
  assert.equal(buf[0], 0x1f, 'gzip magic byte 0')
  assert.equal(buf[1], 0x8b, 'gzip magic byte 1')
  const { raw: back, gzipped } = parseBuffer(buf)
  assert.equal(gzipped, true)
  assert.deepEqual(back, raw)
})

test('plain-JSON round-trip is loss-free and not flagged gzip', () => {
  const raw = fixture()
  const buf = serializeConfig(raw, false)
  const { raw: back, gzipped } = parseBuffer(buf)
  assert.equal(gzipped, false)
  assert.deepEqual(back, raw)
})

test('unchanged open→save preserves unknown fields exactly', () => {
  const raw = fixture()
  const reparsed = parseBuffer(serializeConfig(raw, true)).raw
  // Touch nothing; the opaque surface + custom var must be byte-identical.
  assert.deepEqual(reparsed.surfaces, raw.surfaces)
  assert.deepEqual(reparsed.custom_variables, raw.custom_variables)
})

test('flatten lists every populated control, ordered, with summaries', () => {
  const raw = fixture()
  const rows = flatten(raw)
  assert.equal(rows.length, 3)
  assert.deepEqual(
    rows.map((r) => r.id),
    ['1/0/0', '1/0/1', '1/1/0'],
  )
  // Layered button text + color read across formats.
  assert.equal(rows[0].text, 'CAM 1')
  assert.equal(rows[0].color, '#ffffff')
  assert.equal(rows[0].bgcolor, '#000000')
  assert.equal(rows[0].actionSummary.length, 1)
  assert.equal(rows[0].feedbackSummary.length, 1)
  assert.deepEqual(rows[0].connectionIds.sort(), ['conn_atem', 'conn_kumo'])
  // Flat 3.x button.
  assert.equal(rows[1].text, 'CAM 2')
  assert.equal(rows[1].bgcolor, '#102030')
  // Nav control has no text.
  assert.equal(rows[2].type, 'pageup')
})

test('meta + connection labels', () => {
  const raw = fixture()
  const m = metaOf(raw, flatten(raw).length)
  assert.equal(m.buttonCount, 3)
  assert.equal(m.pageCount, 1)
  assert.equal(m.version, 8)
  assert.deepEqual(connectionLabels(raw), { conn_kumo: 'KUMO', conn_atem: 'ATEM' })
})

test('cell edit writes back in the original color representation', () => {
  const raw = fixture()
  // Layered button used integer colors → must stay integer.
  applyCellEdit(raw, loc(1, 0, 0), 'bgcolor', '#123456')
  const layered = controlAt(raw, loc(1, 0, 0))!
  const fill = layered.style.layers.find((l: any) => !('text' in l))
  assert.equal(typeof fill.bgcolor, 'number')
  assert.equal(fill.bgcolor, 0x123456)
  assert.equal(getField(layered, 'bgcolor'), '#123456')

  // Flat 3.x button used a hex string → stays hex string.
  applyCellEdit(raw, loc(1, 0, 1), 'bgcolor', '#abcdef')
  const flat = controlAt(raw, loc(1, 0, 1))!
  assert.equal(flat.style.bgcolor, '#abcdef')

  // Flat 3.x button used rgb() for color → stays rgb().
  applyCellEdit(raw, loc(1, 0, 1), 'color', '#010203')
  assert.equal(flat.style.color, 'rgb(1, 2, 3)')
})

test('text edit hits the right layer / field', () => {
  const raw = fixture()
  applyCellEdit(raw, loc(1, 0, 0), 'text', 'WIDE')
  const layered = controlAt(raw, loc(1, 0, 0))!
  const textLayer = layered.style.layers.find((l: any) => 'text' in l)
  assert.equal(textLayer.text, 'WIDE')

  applyCellEdit(raw, loc(1, 0, 1), 'size', '22')
  assert.equal(controlAt(raw, loc(1, 0, 1))!.style.size, 22)
})

test('find & replace previews and applies across action options', () => {
  const raw = fixture()
  // Use a replacement that is NOT a superstring of the needle, so a re-scan
  // finds zero remaining matches.
  const q = {
    find: 'conn_kumo',
    replace: 'conn_router',
    scope: 'all' as const,
    regex: false,
    caseSensitive: true,
  }
  const matches = previewReplace(raw, q)
  // Appears in two action entities (connectionId / instance).
  assert.ok(matches.length >= 2)
  const n = applyReplace(raw, q)
  assert.equal(n, matches.length)
  // The down action of the layered button now references the new id.
  const a = controlAt(raw, loc(1, 0, 0))!.steps['0'].action_sets.down[0]
  assert.equal(a.connectionId, 'conn_router')
  // Nothing matches the old id anymore.
  assert.equal(previewReplace(raw, q).length, 0)
})

test('find & replace honours selection scope', () => {
  const raw = fixture()
  const q = {
    find: 'CAM',
    replace: 'CAMERA',
    scope: 'text' as const,
    regex: false,
    caseSensitive: true,
    onlyIds: ['1/0/1'],
  }
  applyReplace(raw, q)
  // Only the selected flat button changed.
  const layeredText = controlAt(raw, loc(1, 0, 0))!.style.layers.find((l: any) => 'text' in l).text
  assert.equal(layeredText, 'CAM 1')
  assert.equal(controlAt(raw, loc(1, 0, 1))!.style.text, 'CAMERA 2')
})

test('template capture + stamp with token substitution', () => {
  const raw = fixture()
  const captured = captureControl(raw, loc(1, 0, 1))!
  // Put a token into the captured template's text.
  captured.style.text = 'SRC {{n}}→{{col}}'
  const tpl: ButtonTemplate = { id: 't1', name: 'src', control: captured, created: '2026-01-01' }

  const targets = [loc(1, 1, 0), loc(1, 0, 0)]
  const n = stampTemplate(raw, tpl, targets)
  assert.equal(n, 2)
  // n is 1-based in target order; col comes from each target location.
  assert.equal(controlAt(raw, loc(1, 1, 0))!.style.text, 'SRC 1→0')
  assert.equal(controlAt(raw, loc(1, 0, 0))!.style.text, 'SRC 2→0')
  // Stamp is a deep copy — editing one target must not affect the other.
  applyCellEdit(raw, loc(1, 1, 0), 'text', 'X')
  assert.equal(controlAt(raw, loc(1, 0, 0))!.style.text, 'SRC 2→0')
})

test('regex replace works', () => {
  const raw = fixture()
  const q = {
    find: 'CAM (\\d+)',
    replace: 'C$1',
    scope: 'text' as const,
    regex: true,
    caseSensitive: true,
  }
  applyReplace(raw, q)
  assert.equal(controlAt(raw, loc(1, 0, 1))!.style.text, 'C2')
})

// ── Button detail: read + action/feedback editing ──────────────────────────

import {
  buildDetail,
  setActionOption,
  setActionConnection,
  setFeedbackOption,
  addAction,
  removeAction,
  moveAction,
  duplicateAction,
  addFeedback,
  removeFeedback,
  replaceActionRaw,
  setActionType,
} from '../src/main/companion/detail'

const A0 = { loc: loc(1, 0, 0), stepId: '0', setKey: 'down', index: 0 } // layered, route
const A1 = { loc: loc(1, 0, 1), stepId: '0', setKey: 'down', index: 0 } // flat, instance/action

test('buildDetail shows actions under their set with connection label + options', () => {
  const raw = fixture()
  const d = buildDetail(raw, loc(1, 0, 0))!
  assert.equal(d.editable, true)
  assert.equal(d.steps.length, 1)
  const down = d.steps[0].sets.find((s) => s.setKey === 'down')!
  assert.equal(down.label, 'When pressed')
  assert.equal(down.actions.length, 1)
  assert.equal(down.actions[0].typeId, 'route')
  assert.equal(down.actions[0].connectionLabel, 'KUMO')
  const keys = down.actions[0].options.map((o) => o.key).sort()
  assert.deepEqual(keys, ['dst', 'note', 'src'])
  // Feedback present
  assert.equal(d.feedbacks.length, 1)
  assert.equal(d.feedbacks[0].typeId, 'tally')
})

test('buildDetail marks nav buttons non-editable', () => {
  const raw = fixture()
  const d = buildDetail(raw, loc(1, 1, 0))! // pageup
  assert.equal(d.editable, false)
  assert.equal(d.steps.length, 0)
})

test('setActionOption changes value, keeps id + other options', () => {
  const raw = fixture()
  assert.equal(setActionOption(raw, A0, 'src', '5'), true)
  const a = controlAt(raw, loc(1, 0, 0))!.steps['0'].action_sets.down[0]
  assert.equal(a.options.src, '5')
  assert.equal(a.options.dst, '1') // untouched
  assert.equal(a.id, 'a1') // preserved
})

test('setActionConnection writes the version-correct key', () => {
  const raw = fixture()
  // Layered button used connectionId
  setActionConnection(raw, A0, 'conn_x')
  assert.equal(controlAt(raw, loc(1, 0, 0))!.steps['0'].action_sets.down[0].connectionId, 'conn_x')
  // Flat 3.x button used `instance` — must stay `instance`, not add connectionId
  setActionConnection(raw, A1, 'conn_y')
  const flatAction = controlAt(raw, loc(1, 0, 1))!.steps['0'].action_sets.down[0]
  assert.equal(flatAction.instance, 'conn_y')
  assert.equal('connectionId' in flatAction, false)
})

test('setActionType updates the existing type key (action vs actionId)', () => {
  const raw = fixture()
  setActionType(raw, A1, 'press') // flat button uses `action`
  const flatAction = controlAt(raw, loc(1, 0, 1))!.steps['0'].action_sets.down[0]
  assert.equal(flatAction.action, 'press')
  assert.equal('actionId' in flatAction, false)
})

test('setFeedbackOption edits feedback options', () => {
  const raw = fixture()
  setFeedbackOption(raw, { loc: loc(1, 0, 0), index: 0 }, 'input', '9')
  assert.equal(controlAt(raw, loc(1, 0, 0))!.feedbacks[0].options.input, '9')
})

test('add / duplicate / move / remove action', () => {
  const raw = fixture()
  const down = (): any[] => controlAt(raw, loc(1, 0, 0))!.steps['0'].action_sets.down
  assert.equal(addAction(raw, loc(1, 0, 0), '0', 'down', 'conn_kumo', 'route2'), true)
  assert.equal(down().length, 2)
  const newId = down()[1].id
  assert.match(newId, /^e_/)
  // duplicate the first → inserted at index 1
  duplicateAction(raw, A0)
  assert.equal(down().length, 3)
  assert.notEqual(down()[1].id, down()[0].id) // fresh id on the copy
  // move the first down by 1
  assert.equal(moveAction(raw, A0, 1), 1)
  // remove index 0
  const before = down().length
  removeAction(raw, A0)
  assert.equal(down().length, before - 1)
})

test('add / remove feedback', () => {
  const raw = fixture()
  const fbs = (): any[] => controlAt(raw, loc(1, 0, 0))!.feedbacks
  addFeedback(raw, loc(1, 0, 0), 'conn_atem', 'border')
  assert.equal(fbs().length, 2)
  assert.equal(fbs()[1].feedbackId, 'border')
  removeFeedback(raw, { loc: loc(1, 0, 0), index: 1 })
  assert.equal(fbs().length, 1)
})

test('replaceActionRaw swaps wholesale and keeps/sets an id', () => {
  const raw = fixture()
  const err = replaceActionRaw(raw, A0, { connectionId: 'conn_kumo', actionId: 'custom', options: { x: 1 } })
  assert.equal(err, null)
  const a = controlAt(raw, loc(1, 0, 0))!.steps['0'].action_sets.down[0]
  assert.equal(a.actionId, 'custom')
  assert.equal(a.options.x, 1)
  assert.equal(typeof a.id, 'string') // id auto-assigned
  // Rejects non-objects
  assert.equal(typeof replaceActionRaw(raw, A0, [1, 2]), 'string')
})

test('detail edits survive a gzip round-trip and leave other buttons intact', () => {
  const raw = fixture()
  setActionOption(raw, A0, 'src', '7')
  addFeedback(raw, loc(1, 0, 0), 'conn_atem', 'border')
  const back = parseBuffer(serializeConfig(raw, true)).raw
  assert.deepEqual(back, raw) // loss-free
  // The untouched flat button is unchanged.
  assert.equal(back.pages['1'].controls['0']['1'].style.text, 'CAM 2')
  // Unknown top-level key preserved.
  assert.deepEqual(back.surfaces, raw.surfaces)
})
