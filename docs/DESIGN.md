# Designing sets and costumes (design.json)

`design.json` in the project folder says what each scene looks like and what each character wears. The agent is the art director: **even when the user describes nothing, the script tells you where and when it happens and who these people are.** Whatever the user did say about the look wins over your own ideas.

`da next` writes a first draft from keywords and then asks you to improve it. `da design --catalog` lists everything ready-made. `da design <dir> --check` validates your work. Every colour and shape follows the chosen style pack automatically, so you never design for one style.

## How to think about it
Before writing anything, answer these from the script:
1. **When?** Today, the 1500s, a fairy tale, the future.
2. **Where, exactly?** Not "a palace" but "a sultan's private room after dinner": what is on the walls, what stands on the floor, what hangs from the ceiling?
3. **What time?** Day or night changes the windows, the lamps and `"night"`.
4. **Who is each person?** Age, rank, job, how much money they have. A sultan and a vizier dress differently, and so do a teacher and a student.

Then build each scene in layers: back wall or sky, something high up (above y = -1000), something behind the characters, something on the floor. **Aim for at least 6 parts per scene.** Prefer the specific object over the generic one.

## The stage
```
          y = -1600  top of a 9:16 wide shot
          y = -1000 .. -1500   empty wall or sky above the heads: fill this
          y =  -900  top of a standing head (characters are 900 tall)
 x = -560 ---------- x = 0 ---------- x = 560     what a 9:16 wide shot shows
          y =     0  the floor line, feet are here
          y =  +300  floor in front of the characters
```
- The two characters stand around x = -290 and x = 290. A part at x = 0 is between them, behind their shoulders.
- In 16:9 the wide shot reaches about x = ±1070, so put extra parts out there too if the format is landscape.
- A part's origin is its **bottom centre**: `"y": -640` means its bottom edge is 640 above the floor.
- `"layer"`: `back` (default, behind the characters), `floor` (flat on the floor), `front` (in front of them; keep it below y = -500 or it will cover faces).

## A scene
```json
{
  "status": "final",
  "concept": "A sultan's private room after iftar, lamplit and tense",
  "scenes": [
    {
      "scene": "s1",
      "base": "palace",
      "night": true,
      "remove": ["arcade"],
      "parts": [
        { "use": "calligraphy", "x": 0, "y": -1380, "s": 0.62 },
        { "use": "drape", "x": -540 },
        { "use": "drape", "x": 540, "flip": true },
        { "name": "Hanging ostrich-egg lamp", "x": -395, "y": -1240, "draw": [
          { "k": "line", "pts": [[0, -300], [0, -120]], "w": 6, "fill": "dark" },
          { "k": "ellipse", "x": 0, "y": -80, "rx": 46, "ry": 62, "fill": "light" },
          { "k": "rect", "x": -30, "y": -20, "w": 60, "h": 16, "r": 6, "fill": "accent1" }
        ] }
      ]
    }
  ],
  "characters": {}
}
```

| field | meaning |
|---|---|
| `scene` | `s1`, `s2` …, or leave it out and keep the script's order |
| `base` | a ready-made set to start from, or `"none"` for a bare stage |
| `remove` | part types of the base to leave out |
| `parts` | what you add, back to front. `use` a catalogue part, or `draw` your own |
| `night` | `true` darkens the set and keeps the characters lit; `false` keeps it bright even if the script says "gece" |
| `wall`, `floor`, `stripe`, `place`, `sky`, `ground`, `hills`, `horizon` | the room or the landscape itself. `place` is `interior` or `exterior`; `hills` can be `null` |
| `x`, `y`, `s`, `flip`, `layer` | position, scale, mirror, layer of a part |
| `opts` | options of a catalogue part. Common: `w`, `h` (size), `fill` (main colour), `base`, `frame`, `glass`, `moon`, `roof`, `n` |

## Costumes
```json
{
  "status": "final",
  "scenes": [],
  "characters": {
    "suleyman": {
      "role": "The sultan, older and calm",
      "colors": { "body": "#7A1F2B", "accent": "#E3A72F", "hair": "#2B2018", "skin": "#EBB48E" },
      "body": { "height": 1.04, "width": 1.08 },
      "costume": { "head": "sultan-kavuk", "body": "kaftan", "face": "beard" }
    },
    "ogretmen": {
      "role": "A strict teacher near retirement",
      "colors": { "body": "#22304A", "accent": "#D9653B", "hair": "#BFBFBF" },
      "accessories": ["glasses"],
      "costume": { "body": "suit" }
    }
  }
}
```
Keys are the speaker ids that `da parse` prints. `costume` takes a `head`, a `body` and a `face` from the catalogue. Anything else in the character file also works here (`hair`, `head`, `eyes`, `nose`, `accessories`, `personality`; see docs/CHARACTERS.md). A file `characters/<id>.json` replaces all of this, because it means "exactly this".

## Drawing what is not in the catalogue
If the story needs a samovar, a throne of skulls or a robot's antenna, draw it. Shapes are plain JSON:

| `k` | fields |
|---|---|
| `rect` | `x`, `y` (top-left), `w`, `h`, optional `r` (corner radius) |
| `circle` | `x`, `y`, `r` |
| `ellipse` | `x`, `y`, `rx`, `ry`, optional `rot` (radians) |
| `poly` | `pts`: `[[x, y], [x, y], …]`, a closed filled shape |
| `line` | `pts`, `w` (width), optional `closed` |
| `ring` | `x`, `y`, `r`, `w` |
| `path` | `cmds`: `[["M", x, y], ["L", x, y], ["Q", cx, cy, x, y], ["C", x1, y1, x2, y2, x, y], ["Z"]]` |
| `repeat` | `n`, `dx`, `dy`, `items`: a row or column of copies, for tiles, railings, windows |
| `mirror` | `items`: drawn, and drawn again flipped left to right |

Every shape takes `fill`, and optionally `alpha` and `noShadow` (use it on small details).

**Colours.** Use palette roles, so the drawing follows the style: `light`, `dark`, `accent1`, `accent2`, `accent3`, `wall`, `wall2`, `wall3`, `floor`, `floor2`, `sky`, `ground`, `hill`, `glass`. A hex value or a colour word also works, and is snapped to the palette when the style locks it. On a costume you can also use the character's own: `body`, `accent`, `hair`, `skin`, `legs`, and `fold` for soft cloth lines.

**A set piece** (`"draw"` in a part): origin is the bottom centre of the piece, y goes up as it gets negative, stage units, so 900 is the height of a person.

**A costume** (`"custom"` in `costume`), in coordinates tied to the body so it fits every style:

| piece | origin and units |
|---|---|
| `hat` | middle of the brim; 1 = head radius; up is negative |
| `back` | same as `hat`, drawn behind the head (plumes, veils) |
| `face` | centre of the head; 1 = head radius |
| `body` | x from -1 to 1 across the torso, y from 0 at the shoulders to 1 at the hem |

Draw facing right; it is mirrored when the character faces left.

```json
{
  "status": "final",
  "scenes": [
    { "scene": "s1", "base": "none", "place": "exterior", "sky": "sky", "ground": "ground", "horizon": -60, "parts": [
      { "use": "mountain", "x": 200, "y": -60 },
      { "use": "pine", "x": -470, "y": -70, "s": 1.1 },
      { "use": "tent", "x": 410, "y": -30 },
      { "use": "campfire", "x": 0, "y": 12, "s": 0.8 },
      { "use": "stars", "x": 0, "y": -1250 },
      { "name": "Rope bridge", "x": -300, "y": -420, "draw": [
        { "k": "repeat", "n": 8, "dx": 62, "items": [{ "k": "rect", "x": -18, "y": -12, "w": 36, "h": 12, "fill": "accent3" }] },
        { "k": "line", "pts": [[-30, -70], [460, -70]], "w": 6, "fill": "dark" }
      ] }
    ] }
  ],
  "characters": {
    "kaptan": {
      "role": "An old sea captain",
      "costume": {
        "body": "vest",
        "custom": {
          "hat": [
            { "k": "poly", "pts": [[-1.1, 0.04], [-0.9, -0.7], [0.9, -0.7], [1.1, 0.04]], "fill": "dark" },
            { "k": "rect", "x": 0.2, "y": -0.02, "w": 1.2, "h": 0.16, "r": 0.08, "fill": "dark" },
            { "k": "circle", "x": 0, "y": -0.38, "r": 0.18, "fill": "accent1", "noShadow": true }
          ],
          "body": [
            { "k": "repeat", "n": 3, "dy": 0.2, "items": [{ "k": "mirror", "items": [{ "k": "circle", "x": 0.3, "y": 0.2, "r": 0.06, "fill": "accent1", "noShadow": true }] }] }
          ]
        }
      }
    }
  }
}
```

## Before you finish
- [ ] Could someone guess the period and place from one frame, with the sound off?
- [ ] Is there something above head height in every scene?
- [ ] Does every character look like who they are, and different from each other?
- [ ] Nothing in the `front` layer covers a face.
- [ ] `da design <dir> --check` is clean, and `"status": "final"` is set.

If you can see images, run `da stills <dir>` after the board step and look at `build/stills/sheet.png`. Then fix the design and run `da next` again: only what changed is redone.
