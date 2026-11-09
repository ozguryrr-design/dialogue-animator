# Staging: what happens on screen

`design.json` says what things look like. `staging.json` says what **happens**: who comes from where, what they carry, take, give or hide, and where the camera goes. Two people standing and talking is not a story being told; if the script says a pot is put down, somebody has to put it down.

`da next` stops at this step and hands you the timed script. An agent writes the file by reading the story. Without one, the automatic draft is used: it only finds common verbs in the script.

```bash
node bin/da.mjs stage <project>            # writes the first draft and prints the timed script
node bin/da.mjs stage <project> --sheet    # prints the timed script again
node bin/da.mjs stage <project> --check    # validates staging.json
node bin/da.mjs stage <project> --accept   # marks it final as it is
```

## The stage

- x is horizontal, in stage units. Characters are about 900 tall. A 9:16 frame is about 1100 wide on a two-shot.
- Everybody starts on an automatic mark near x = 0 unless `start` says otherwise. Put someone at x = -2300 and they are well outside the frame.
- The set repeats by itself wherever the camera goes past its edge, and far-away pieces slide more slowly than near ones. To make a journey look like a journey, add parts along the route in `design.json` (a stall at x = -1650, a well at x = -2750).
- A part in `design.json` may have `"depth"`: 1 is the characters' plane, 0.3 is far away, 1.5 passes close to the lens.

## Times

Everywhere `at` appears: seconds (`12.5`), a line (`l3`, `l3+0.5`, `l3.end`, `l3.end-0.2`), a timed beat (`b2`, `b2+1.5`, `b2.end`), or `+0.4` for "after the previous action". `--sheet` lists the lines and beats with their times.

## A complete example

```json
{
  "status": "final",
  "idea": "He carries the pot down the street; she steps out of her door and takes it.",
  "scenes": [
    {
      "scene": "s1",
      "keepScriptActions": false,
      "objects": {
        "pot": { "use": "cauldron", "hold": "both" }
      },
      "start": {
        "ali": { "x": -2300, "holding": "pot" },
        "su": { "x": 420, "face": "left", "hidden": true }
      },
      "do": [
        { "at": 0, "who": "ali", "walk": -320, "dur": 3.8 },
        { "at": "+0.1", "who": "ali", "put": "pot", "x": 60, "sfx": "clink" },
        { "at": "+0.3", "door": "open", "dur": 0.5 },
        { "at": "+0.1", "who": "su", "hidden": false },
        { "at": "l2", "who": "su", "walk": "ali" },
        { "at": "l3", "who": "su", "face": "surprised" },
        { "at": "l3+1", "who": "ali", "gesture": "shrug" }
      ],
      "camera": [
        { "at": 0, "on": "ali", "size": "full" },
        { "at": 3.6, "on": "pot", "size": "wide" },
        { "at": "l2", "on": ["ali", "su"], "size": "two" },
        { "at": "l3", "on": "su", "size": "medium", "push": 0.08 },
        { "at": "l3+1", "on": "ali", "size": "close", "speed": "fast" }
      ]
    }
  ]
}
```

## `objects`: anything that gets handled

| field | meaning |
|---|---|
| `part` | use a part of this scene in `design.json`, by its `name` |
| `use` | a catalogue part (`da design --catalog`), for example `cauldron`, `pot`, `sack`, `box`, `basket`, `sword`, `letter`, `key`, `bag` |
| `draw` | your own shapes, as in `design.json`; give `w` and `h` |
| `x`, `y`, `s` | where it stands and its scale |
| `hidden` | not visible until somebody takes it (inside something) |
| `hold` | how it is carried: `near` (one hand), `both`, `behind` (behind the back) |

## `start`: where people are at the first moment

`x`, `face` (`left` or `right`), `sit`, `hidden` (behind a door, say), `holding` (an object) and `hand`.

## `do`: one action per entry

| action | fields |
|---|---|
| walk, run, tiptoe | `"walk"`, `"run"` or `"sneak"`: a number, a person, an object, `"home"` (their automatic mark), `"off-left"`, `"off-right"`. Optional `dur`, `stop` (distance from the target), `keepFacing` |
| a small step | `"step": "toward"` or `"back"`, with `of` (who) and `by` (units) |
| turn | `"turn"`: `left`, `right`, a person, an object |
| take, put down | `"take": obj`, `"put": obj` with optional `x`, `y`, `sfx` |
| give | `"give": obj, "to": person` |
| hide, show | `"hide": obj` puts it behind the back, `"show": obj` brings it out |
| gesture | `"gesture"`: wave, point, shrug, facepalm, cheer, explain, think, hips, nod, place, reach, give, hide. Optional `dur` |
| expression | `"face"`: neutral, happy, laugh, sad, angry, surprised, scared, thinking, worried, smug, stern, downcast |
| glance | `"look"`: a person, an object, `up`, `down`. Eyes only. Optional `dur` |
| sit, stand | `"sit": true`, `"stand": true` |
| appear, disappear | `"hidden": true` or `false` |
| a door | `"door": "open"` or `"close"`, optional `part` |
| an object moves by itself | `"object": obj` with `x`, `y`, `dur`, `visible` |
| reaction symbol | `"fx"`: exclaim, question, sweat, drop, anger, sparkle, heart, idea |
| fade | `"fade": "in"` or `"out"`, optional `dur` |
| sound | `"sfx"`: a built-in name (door, bolt, clink, knock, whoosh, step) or a file in `sfx/` |

Everything except `door`, `object`, `fade` and `sfx` needs `"who"`. Footsteps are added to walks automatically; `"footsteps": false` on the scene or on one action turns them off.

`"keepScriptActions": false` means your `do` list is the complete list of what happens. Leave it out only to let the timed directions in the script act themselves out as well.

## `camera`: one entry for each thing to look at

There is one camera and it moves. It glides from one entry to the next and keeps tracking whoever it is on, so someone walking across the street stays in frame by itself.

| field | meaning |
|---|---|
| `on` | a person, several people `["a", "b"]`, an object, or a number (a place on the x axis) |
| `size` | `wide`, `two`, `full` (head to toe), `medium`, `close` |
| `speed` | `fast`, `normal`, `slow`: how quickly it gets there |
| `push` | how much it creeps in during the entry (`0.08`), negative pulls out |
| `drift` | `left` or `right`, a sideways slide that shows the depth of the set |
| `crane` | `up` or `down`, a rise or a descent at the start of the entry |
| `cut` | `true`: a hard cut. Use it when a cut is the point |
| `whip` | `true`: a fast blurred swing to the next subject |

Good habits: an entry at least every 3 seconds, `full` on whoever is moving, `two` when both matter, `close` only for the strongest lines, and let the object be seen at the moment it matters.

Without a `camera` list the director plans one from the lines. To go back to separate static shots with hard cuts, set `"director": { "camera": "cut" }` in `project.json`.

## Limits

People move only along the x axis: left and right, not towards the camera. Walking is a side-on puppet walk. An object is carried at the hand; it cannot be put into another object in a way that hides part of it.
