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

## Camera
- **No static holds.** Every shot creeps in by `camera.pushPerFrame` (paper 0.12 %/f, jöle 0.25 %/f, riso 0.08 %/f), toward the face of the subject. Strong close-ups use `punchPushPerFrame`. The total creep is capped at 15 %.
- **Group shots creep only as far as the empty margin allows** (nobody gets cut). Two-shots drift 5 % toward whoever speaks.
- **Pan speed** is capped at `camera.maxPanPxPerFrame` at output resolution.
- **Dutch angle** of ±`camera.rollDeg` on strong close-ups (alternating sign); 0 for calm styles.
- **Punch-in** (`camera.punchZoom`, jöle 8 % over 7 f with overshoot) on strong close-ups; **shake** (`camera.shake`, flips sign every frame, decays over 7 f) on angry or surprised "!" words.
- **Transitions**: in-scene cuts use `transitions.cut` (paper: hard cut, riso: 4-frame dissolve). Scene changes use `transitions.scene` (paper-slide 10 f, iris 12 f, ink-wipe 14 f). An optional `transitions.speakerChange` (jöle: whip, 8 f) is used on every third speaker change.

## Acting
- The speaker's expression = the line's emotion, set `cutLeadFrames` before the line.
- **Listeners react to the trigger word** (the emotional word found by the lexicon, or the last word) `motion.reactionLeadFrames` (4) frames **before** it is heard. Reaction map: surprised→surprised, angry→worried, sad→sad, happy/laugh→happy, scared→scared, smug→thinking, worried→worried. Questions make the listener think.
- A small symbol (!, ?, sweat, anger, sparkle, drop) pops next to the reacting character, at most one per 3 s, only if that face is in frame, and never past the end of its scene.
- Gestures come from directions in the dialogue or from greetings (wave). High-energy characters "explain" on lines ≥ 2.4 s.

`da board` prints every shot with the reason it exists; `da qa` re-runs the lint.
