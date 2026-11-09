# Troubleshooting and gotchas

A growing list of real failures met while building and using this skill. When you hit a new one, add it in the same format: **symptom → cause → fix**.

## Setup
1. **`ffmpeg not found`**: install it (`winget install Gyan.FFmpeg`, `brew install ffmpeg`, `sudo apt install ffmpeg`), set `FFMPEG_PATH`, or `pip install imageio-ffmpeg`. `da doctor` lists everything it tried.
2. **No `ffprobe`**: fine. Some installs (e.g. the imageio-ffmpeg wheel) ship ffmpeg only, so every duration comes from decoded sample counts. Never add an ffprobe dependency.
3. **`@napi-rs/canvas` cannot load**: run `npm install` in the skill folder. On unusual platforms use `--renderer playwright` (docs/RENDERERS.md).
4. **Squares instead of letters**: the style's fonts lack those characters. `da doctor <project>` prints them; add a covering font with `"fallback": true` (docs/STYLE_PACK.md).
5. **A system font with the same family name wins** over the bundled one: bundled fonts are registered under aliases (`DA Baloo 2`, `DA Noto Sans`). Keep that prefix in custom packs. The variable fonts are used unmodified (OFL); `@napi-rs/canvas` honours their weight axis.

## Timing and audio
6. **Lines feel late or early** with one voice file: install `faster-whisper` or provide `words.json`. Silence detection can be ±0.3 s on soft onsets. Per-line files are always exact.
7. **whisper on gibberish (babble) or music-heavy audio** gives useless words. Use per-line files for those.
8. **Audio file mapped to the wrong line**: files are matched by their leading number. `align` warns when a file's name does not match the speaker.
9. **True peak just above −1 dBTP in the mp4**: `loudnorm` in linear mode can overshoot slightly and AAC adds about 0.3 dB. The mix targets −2 dBTP and trims the whole mix if needed.

## Picture
10. **A close-up looks cropped in a contact sheet, but the full frame is fine**: small thumbnails exaggerate tightness. Check `da stills --t <s> --scale 1` before changing framing.
11. **Eyebrows disappear under a fringe**: face features must be drawn after the front hair (fixed in all bodies).
12. **Over-the-shoulder shot cuts the speaker's face** in portrait: the shift toward the listener is limited so the speaker's head (×1.35 margin) stays inside.
13. **A group shot cuts the outermost character in 16:9**: the push-in of group shots is limited by the empty margin.
14. **A hand covers the prop in a cutaway**: inserts draw the set only, no characters.
15. **Two characters end up with the same hair or outfit colour** when the palette is small: snapping avoids colours already used. Hair keeps its lightness first (dark brown → ink, not a pastel).
16. **A "?" or caption of the last line shows up in the next scene**: captions and reaction symbols are clipped at their scene's end.
17. **A reaction symbol pops at the frame edge for an off-screen character**: symbols are drawn only for faces that are in frame.
18. **One-syllable words flash for 4–5 frames** in word captions: short words travel with a neighbour, but never across a sentence end ("ol. Bir" was wrong).
19. **Tiny features look chewed in the riso style**: line tremble on small shapes is scaled down (features get 15 % of the jitter).
20. **Fine halftone or grain turns to mush** after H.264: keep the pitch ≥ 12 px at 1080 wide; use `-tune animation`.

## QA
21. **"Unplanned pop" right after an expression change**: the style's squash is intentional. QA treats expression, gesture, punch and shake frames as planned. A pop elsewhere is a real bug.
22. **Characters on twos (15 fps) look frozen**: they are not. The camera still moves every frame; the frozen check only fires on ≥ 12 identical frames.

## Found in the first real-user test (timed historical scene, one ElevenLabs recording)
25. **Turkish words from whisper come out as `�` on Windows**: Python printed JSON in the console code page (cp1254). The helper now prints ASCII-escaped JSON and runs with `PYTHONIOENCODING=utf-8`. Before the fix, 0 of 28 words matched; after it, 28 of 28.
26. **A 15 s recording, a 30 s script**: a single file used to keep its own timeline. With beats it is now cut into line clips at the quietest points between lines and placed into the windows.
27. **"Audio 5 frames early" although the voice was exact**: correlating the whole mix with binary line intervals breaks with sparse dialogue plus loud effects (door, bolt). QA now compares the final audio with the timed voice track, around the lines only.
28. **Loudness stuck at −15.2 LUFS**: a dynamic voice has more crest than linear loudnorm allows at −2 dBTP. A look-ahead limiter now trims the excess peaks first (3.9 dB in that test), then the mix reaches −14.
29. **Captions disappearing were reported as "pops"**: caption on/off frames are planned changes now.
30. **Brown beard turned teal** (palette snap with avoidance): hair snapping now penalises far hues instead of excluding used colours outright.
31. **"Süleyman gözünü İbrahim'den ayırmaz" did nothing**: a name sat between the words of the stem. Single-word stems (`ayirmaz`) are matched too, and the subject is the name that appears first.
32. **Seated characters showed their robe hems and shoes under the table**: the table cloth now reaches past the floor line.
33. **A turban covered a third of a close-up**: the turban dome was scaled down so it sits above the highest brow position.
34. **A beat line without a direction ("5–10 sn") crashed the parser**: fixed. Covered by a test.
35. **A narrator turned into a character on screen**: names like Anlatıcı, Narrator or anything declared with `@narrator` are heard only. A plain name that never appears in `@cast` and speaks only with `(dış ses)` is treated the same way. If a real character disappeared, add `@cast Name` to the scene.
36. **Narration written as a plain paragraph vanished into the previous speaker's line**: a line without `Name:` continues the previous line. Put `Anlatıcı:` in front of it.
37. **"sound effect not found"**: the name after `@sfx` must match a file in `sfx/` or a built-in. `da next` stops before rendering so it cannot be missed.
38. **A recording was not used**: per-line files are matched by their leading number, counting narration lines too. A file with no number or a number with no line is now reported by `align`.
39. **Half a second of nothing at the start of a scene**: dropping a very short first shot left a hole before the next one. The first shot now always starts with the scene.
40. **`@sfx name -6dB` made no difference when it was the only cue**: the effects track was normalized after the gains. The level is now set from the mix at 0 dB.
41. **`da init` refused a folder that already had a script**, so someone with only a dialogue could not get the folders prepared. It now creates what is missing and leaves the script alone. It also no longer writes a sample script unless you pass `--sample`, because an agent could have turned that sample into your video.
42. **"has no Name: text lines"**: every spoken line needs its speaker in front (`Ali: Merhaba.`). If the script does not say who speaks, the agent has to ask.
43. **A sultan in the riso style came out bald with a bun, no kavuk and no kaftan**: turbans, crowns, beards and robes were only drawn by the paper-cut body, and a `robe` shape broke the riso one. Costumes now live in one wardrobe that every body draws.
44. **Every video looked like the same room**: nothing designed the world of the story. `da next` now has a design step, with about 90 parts, a costume catalogue and free drawing in `design.json` (docs/DESIGN.md).
45. **`design.json has problems`**: each line names the scene or character and usually the fix. `da design <dir> --check` shows them again. `da design --catalog` lists every valid id.
46. **Captions were unreadable in riso over dark areas**: the ink text had nothing behind it. Riso captions now sit on a paper plate.
47. **A video with no voice and no music failed QA on loudness**: silence has no level to reach, so the check now passes with a note.
48. **A tall hat was cut off in the wide shot**: framing now counts the height of what a character wears.

49. **"Two characters just stand there, nothing from my story happens"**: only 11 stage directions were understood, and nobody could move or hold anything. Characters now walk, run, tiptoe, carry, give and hide, and the agent writes what happens in `staging.json` (docs/STAGING.md).
50. **The camera only cut between big faces**: there is now one moving camera per scene that follows the action. For the old behaviour, `"director": { "camera": "cut" }`.
51. **`staging.json has problems`**: each line names the scene and the entry and usually the fix. `da stage <dir> --check` shows them again. Somebody who does not speak has to be added to the script with `@cast Name`.
52. **The camera runs past the end of the set and shows empty sky**: sets now repeat wherever the camera goes. Long pieces continue edge to edge and small ones repeat as a group.
53. **A door was heard closing but never seen** when the same beat also had someone standing up: the shot on the door ended before the door moved, and the two-shot took over. The camera now stays on the door while it moves.
54. **"has stage directions but nobody to act them out"**: a script with no speech has to name its characters: `@cast Ali, Su`.
55. **`ffmpeg failed` on `alimiter` in a video with footsteps and no voice or music**: sparse sound effects are not a programme to normalize. They are now left at their own level.

## Repository / tooling
23. **`spawnSync` fails with a negative `maxBuffer`** when the buffer size is computed as `1 << 31` (overflows to negative in JavaScript). Use `2 ** 32`.
24. **Concat list paths on Windows**: write them with forward slashes and single quotes for ffmpeg's concat demuxer.
