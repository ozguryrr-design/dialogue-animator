# Style packs

A style pack is a folder with a `style.json` (schema: `schemas/style-pack.schema.json`), an optional `README.md`, an optional `preview/`, and optionally fonts or a `style.mjs` hook file. Packs live in `styles/<id>/` (shipped) or `<project>/styles/<id>/` (project-local; these win).

```bash
da styles                                   # list
da style new my-pack --from kesik-kagit     # copy a pack (add --project <dir> to create it inside a project)
da style check my-pack                      # schema + measurable limits (docs/STYLE_GUIDE.md)
da style preview my-pack                    # renders the standard test scene -> styles/my-pack/preview/sheet.png
da style palette reference.png              # dominant colours of an image, as hex
```

Use a pack with `"style": "my-pack"` in project.json, `--style my-pack`, or a path: `"style": "./styles/my-pack"`.

## style.json sections
| key | what it controls |
|---|---|
| `family` | the **material**: `paper` (jittered cut pieces + layer shadow), `gummy` (fill + uniform outline + gloss), `line` (ink monoline + off-register multiply fill + halftone) |
| `palette.roles` | named colours used by sets, props and captions: `paper, ink, wall, wall2, wall3, floor, floor2, sky, ground, hill, accent1–3, light, dark, glass` (+ `white`) |
| `palette.characterColors` / `skin` | colours characters snap to (`lockToPalette: true`) / skin tones |
| `palette.gradient` | optional vertical gradient for a role, e.g. `"wall": ["#1B1440", "#2A1E5C"]` |
| `line`, `shadow`, `edge`, `texture` | outline mode and width, layer shadow, cut-edge jitter and boil rate, grain / gloss / halftone |
| `character` | `body` builder (`paper-cut`, `gummy`, `lanky-line`), `headRatio`, `limbWidth`, `jointPins`, `featureColor` |
| `motion` | `characterFps` (15 = on twos), expression blend frames, squash, spring, overshoot, breath/bob/sway, blink, reaction lead, gesture blend, head nod |
| `camera` | push-in per frame, punch push, pan limit, roll, punch-in zoom, shake, cut lead frames |
| `transitions` | `cut`, `scene`, optional `speakerChange`: `cut, dissolve, paper-slide, whip, iris, ink-wipe` + `frames` |
| `captions` | `font` + per mode (`word`, `line`, `bubble`): `size, fill, bg, bgOpacity, stroke, strokeColor, highlight, dim, y, padX, padY, maxWidth, maxLines, pop (step/spring/none), uppercase, tilt` |
| `fonts` | font files and the family alias the captions use. Mark a broad-coverage font `"fallback": true`. Fonts must be open-licensed; keep their licence next to them. |
| `music` | `tempo, mood (warm/playful/calm/tense), scale, lead (kalimba/marimba/bell/synth)` for the synthesized score |
| `limits` | `maxColors`, `minTextContrast`, `minLinePx`, checked by `da style check` |

Families and bodies are independent: `paper` material with the `gummy` body gives cut-paper blobs. Mix freely.

## Non-Latin dialogue
`da doctor` compares every character of the dialogue with the pack's fonts. For Japanese, Chinese, Korean, Arabic, Hebrew or Devanagari, add a font that covers them (for example a Noto Sans variant under the OFL) to `fonts`, with `"fallback": true`.

## Hooks: style.mjs (code, optional)
When the JSON is not enough, a pack may ship `style.mjs` exporting any of:

```js
export default {
  bodies: { 'my-body': { metrics(ch, style) { … }, build(ch, state, env) { return { items: [/* shape specs */] }; } } },
  transitions: { 'my-wipe'(ctx, env, u, drawA, drawB) { … } },
  background(ctx, env, scene, cam, seed) { … },   // replaces the set painter
  beforeCaptions(ctx, env, t) { … },
  afterFrame(ctx, env, t) { … },                  // e.g. a custom texture overlay
};
```

Hooks must stay pure: Canvas2D only, no `Math.random`, no I/O. Shape specs and helpers are documented in `src/engine/shapes.mjs` and `src/engine/materials.mjs`.

**Safety**: a `style.mjs` is code that runs on your machine. Read it before using a pack from someone you do not trust. Packs made only of `style.json` cannot run code.

## Adapting ready-made sets
Two optional keys let a pack adjust the catalogue without new art. `"sets"` overrides the surfaces of a set: `"sets": { "palace": { "wall": "wall", "stripe": "accent2" } }`. `"propOpts"` sets default options of a part: `"propOpts": { "blackboard": { "fill": "accent2" } }`. A print style with few inks uses these to keep large areas light.
