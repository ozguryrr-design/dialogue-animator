# Characters

A character is a small JSON object (`schemas/character.schema.json`). The same object renders in every style pack: the pack's body builder decides the geometry (paper puppet, gummy blob, lanky line figure), and its palette decides the final colours.

```json
{
  "id": "deniz",
  "name": "Deniz",
  "body": { "shape": "trapezoid", "height": 1.12, "width": 1.0 },
  "head": { "shape": "round", "size": 1.0 },
  "colors": { "skin": "#F6D3B8", "body": "mustard", "hair": "ginger", "legs": "navy", "accent": "red" },
  "hair": { "style": "curly" },
  "eyes": { "size": 1.0, "lashes": false },
  "brows": { "weight": 1.0 },
  "nose": "dot",
  "accessories": ["glasses"],
  "personality": { "energy": 0.85, "baseline": "neutral" }
}
```

| field | values |
|---|---|
| body.shape | trapezoid, rect, round, pear, triangle, robe (long garment to the floor: kaftan, dress, coat) |
| body.height / width | 0.7–1.3 / 0.7–1.4 (1 = average) |
| head.shape / size | round, oval, square, egg / 0.8–1.25 |
| colors.* | `#RRGGBB` or a colour word in English or Turkish (red/kırmızı, navy/lacivert, mustard/hardal, teal, ginger/kızıl, blonde/sarışın …) |
| hair.style | none, short, bob, long, bun, spiky, curly, ponytail |
| nose | none, dot, button, long |
| accessories | glasses, hat, beanie, scarf, bowtie, tie, earrings, beard, mustache, freckles, headphones, flower, blush, turban (hides the hair), crown |
| personality.energy | 0–1. High energy adds "explain" gestures on long lines. |
| personality.baseline | resting expression (neutral, happy, smug, worried, thinking …) |

## Where characters come from (priority)
1. `characters/<id>.json`: exact.
2. `characters/<id>.md` / `.txt`: read by a keyword reader for Turkish and English. Colour words attach to the noun next to them ("kırmızı ceket", "red jacket", "ceketi kırmızı"). It also recognises height (uzun boylu / tall), build, hair style, accessories and personality words. It prints what it understood. **An agent should write the JSON itself**; the reader is the fallback for agents that cannot.
3. `characters/<id>.png|jpg`: dominant colours (k-means on a 48×48 thumbnail) become skin, outfit, hair and accent. Shape and hair style stay generated.
4. Generated from the dialogue: deterministic from the id. Neighbouring characters always get different outfit colours and shapes. Energy comes from how often they exclaim. **Gender is never inferred from a name.**
5. `project.json → characters.overrides.<id>` is merged last.

## Palette snapping
If the style pack sets `lockToPalette`, outfit colours snap to the pack's `characterColors` (the nearest by ΔE). Two characters never get the same outfit colour, and an outfit never matches the wall. Hair keeps its lightness first (dark brown → the pack's darkest ink, not a pastel) and never repeats another character's hair colour. Skin tones snap to the pack's `skin` list (five tones in every default pack).

## Expressions, gestures, mouth
- **Expressions** (12): neutral, happy, laugh, sad, angry, surprised, scared, thinking, worried, smug, stern (narrowed eyes, low flat brows), downcast (eyes lowered, half lids). Each is a set of numbers (brow raise/tilt, eye scale, lid, eye shape, look direction, mouth curve/open/width/skew) in `src/engine/expressions.mjs`, so any two can be blended over `motion.expressionFrames`.
- **Gestures** (10): wave, point, shrug, facepalm, cheer, explain, think, hips, nod, place (reach down to set something on a table) (`src/engine/poses.mjs`). Hand-to-face poses use 2-bone IK.
- **Posture**: standing or seated (sinks 20 % behind a table). It changes with `posture` events from beat directions; the character leans forward while getting up or sitting down.
- **Idle**: breathing (`motion.breath`, `breathHz`), bob or sway per style, listeners tilt their head toward the speaker, speakers nod on punctuated words.
- **Blinks**: every `motion.blinkEvery` seconds (seeded), `blinkFrames` long, never on top of an expression change.
- **Mouth**: openness per frame comes from the voice's amplitude envelope (per-line or whisper-aligned audio), or from word timings (one open/close per vowel) when there is no audio. Rounded vowels (o, u, ö, ü …) narrow the mouth.

## Costumes
Characters can wear what their story needs: `"costume": { "head": "kavuk", "body": "kaftan", "face": "beard" }`. The pieces are in `src/engine/wardrobe.mjs` and listed by `da design --catalog`. They are drawn relative to the body, so the same costume works in every style, and the agent can draw new ones with shapes (docs/DESIGN.md). A long garment such as a kaftan switches the body to the `robe` silhouette by itself. Costumes are usually set in `design.json`; `characters/<id>.json` can set them too, and a description in `characters/<id>.md` is read for words like "kaftanlı", "kavuklu", "üniformalı" or "lab coat".

Priority per character: generated < `design.json` < image colours < description < `characters/<id>.json` (exact: the design is then ignored) < `project.json` overrides.
