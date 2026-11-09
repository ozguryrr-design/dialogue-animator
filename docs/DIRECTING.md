# Directing rules (src/director/storyboard.mjs)

The director turns lines and their timings into shots, camera moves and character events. Every rule is a number you can change in `project.json → director` or in the style pack's `camera` / `motion`.

## Staging
- Characters stand on one ground line, ordered left to right by first appearance in the whole dialogue. The order is kept in every scene, so the 180° line is never crossed.
- Spacing is `max(480, halfWidthA + halfWidthB + 50)` stage units. People on the left face right, people on the right face left; middle characters turn toward whoever speaks.
- Each scene's set comes from its label or its words (docs/PROJECT_FOLDER.md). If a line mentions a known prop (tea, coffee, clock, phone, book, plant, cake, umbrella) and the set does not have it, the prop is added so a cutaway can show it.

## Coverage (shot types)
| type | framing (portrait 9:16) | used for |
|---|---|---|
| `two` | everyone, full body, ground at 70 % of the height | opening of every scene; every 4th shot after three singles |
| `ots` | speaker from the knees up, framed toward the listener, but the speaker's face stays fully inside | default for a speaker (alternates with `medium`) |
| `medium` | speaker, full body plus headroom | alternates with `ots` |
| `close` | head and shoulders | lines with a strong emotion (surprised, angry, scared, laugh) or a short "!" line |
| `reaction` | listener, medium-close | middle of long lines; right after the punch word of an emotional line |
| `insert` | the prop alone, no characters | a line names a prop (≤ 1 per 7 s, line ≥ 1.6 s) |

## Rhythm
- **Cut to the speaker `cutLeadFrames` (4) frames before their first syllable.** If the pause before a new speaker is ≥ 0.9 s, cut 0.15 s after the previous line ends, so we see the next speaker react before they talk.
- **Minimum shot 0.8 s** (24 f). Shorter cuts are merged into a neighbour, moving the cut earlier when that is possible.
- **Maximum single hold 4.5 s.** Longer lines get a reaction cut near the middle, then a return to the speaker in a different framing.
- **Never the same framing twice in a row** (same type and same subject). A repeat becomes the other framing.
- **After three singles, re-establish** with a two-shot (if the line is ≤ 3 s).
- **Speaker on screen ≥ 60 %** of the speaking time. The lint warns below that; the example reaches 95 %.

## Movement
Everything in `staging.json` (docs/STAGING.md). With no file, a draft reads the verbs of the script (walks, runs, takes, gives, hides, carries, puts down), has someone walk in, and adds small steps on strong lines.

## Camera
By default there is one camera per scene. `src/director/blocking.mjs` follows the shots frame by frame with a critically damped spring and aims a little ahead, so it arrives with the action and shots run into each other. Set `"director": { "camera": "cut" }` in `project.json` for separate static shots with hard cuts; the rest of this section describes those.

- **No static holds.** Every shot creeps in by `camera.pushPerFrame` (paper 0.12 %/f, jöle 0.25 %/f, riso 0.08 %/f), toward the face of the subject. Strong close-ups use `punchPushPerFrame`. The total creep is capped at 15 %.
- **Group shots creep only as far as the empty margin allows** (nobody gets cut). Two-shots drift 5 % toward whoever speaks.
- **Pan speed** is capped at `camera.maxPanPxPerFrame` at output resolution.
- **Dutch angle** of ±`camera.rollDeg` on strong close-ups (alternating sign); 0 for calm styles.
- **Punch-in** (`camera.punchZoom`, jöle 8 % over 7 f with overshoot) on strong close-ups; **shake** (`camera.shake`, flips sign every frame, decays over 7 f) on angry or surprised "!" words.
- **Transitions**: in-scene cuts use `transitions.cut` (paper: hard cut, riso: 4-frame dissolve). Scene changes use `transitions.scene` (paper-slide 10 f, iris 12 f, ink-wipe 14 f). An optional `transitions.speakerChange` (jöle: whip, 8 f) is used on every third speaker change.

## Beats (timed scripts)
- Lines go into their beat's window. Actions start 0.3 s into the beat, and expressions set by a direction start at the beat.
- **Standing up / sitting down** is shown in a two-shot (from 0.25 s before the move until 0.5 s after it), then the camera cuts back to whoever is speaking. Seated characters drop 20 % of their height behind a low table (`sofra`), are staged by their shoulders (closer together), and group shots put the table edge at 66 % of the frame height. Single shots that contain a posture change become medium shots tall enough for both positions.
- **Silent beats** (directions only) get their own shot: an insert on the door if a door moves, otherwise a wide shot.
- **Door → bolt → fade** in one beat: the door starts closing at 20 % of the beat (lasting up to 1.8 s). The thud lands when it shuts, the bolt 0.55 s later, and the fade starts 0.2 s after the bolt and ends 0.4 s before the beat does.
- **A long silence after a line** (≥ 1.6 s before anyone speaks again) cuts to the listener 0.3 s after the line, so the pause plays on their face. This is skipped when the listener is the next speaker (the "cut early" rule already covers it).
- **Intense lines** (`stern`) get a close-up, like strong lines, but without roll or punch-in.

## Narration
Lines marked `voiceOver` (narrators, `Ali (dış ses):`) are heard, not acted:
- Nobody's mouth moves, nobody gestures, nobody reacts. A narrator has no character and no place on stage.
- Narration starts on a wide shot of the whole stage. Every 3.2 s, at a word boundary, the camera moves to something else: the cast in medium shots, or the props of the set in inserts when the stage is empty.
- A character's mouth stays closed during their own `(dış ses)` line, and they are not counted as "the speaker" for cuts and rhythm.
- `@cast` puts characters on stage who have no spoken line in that scene.
- Bubble captions fall back to `line` for narration: there is nobody to attach the balloon to.

## Acting
- The speaker's expression = the line's emotion, set `cutLeadFrames` before the line.
- **Listeners react to the trigger word** (the emotional word found by the lexicon, or the last word) `motion.reactionLeadFrames` (4) frames **before** it is heard. Reaction map: surprised→surprised, angry→worried, sad→sad, happy/laugh→happy, scared→scared, smug→thinking, worried→worried. Questions make the listener think.
- A small symbol (!, ?, sweat, anger, sparkle, drop) pops next to the reacting character, at most one per 3 s, only if that face is in frame, and never past the end of its scene.
- Gestures come from directions in the dialogue or from greetings (wave). High-energy characters "explain" on lines ≥ 2.4 s.

`da board` prints every shot with the reason it exists; `da qa` re-runs the lint.
