# QA report — Çay Krizi

Video: `out/cay-krizi.mp4` · verdict: **PASS** · 0 fail, 0 warn

| group | check | result | detail |
|---|---|---|---|
| specs | video stream | PASS | h264 1080x1920 @ 30 fps (expected 1080x1920 @ 30) |
| specs | audio stream | PASS | aac 48000 Hz stereo |
| specs | duration | PASS | 22.870 s (storyboard 22.840 s) |
| frames | frame count | PASS | 686 decoded (storyboard 686) |
| frames | black frames | PASS | none |
| frames | white frames | PASS | none |
| frames | frozen spans >= 12 f | PASS | none (every hold moves) |
| frames | unplanned pops | PASS | none |
| audio | loudness | PASS | -13.7 LUFS integrated (target -14 ±1), LRA 3.1 LU |
| audio | true peak | PASS | -5.3 dBTP (limit -1.0) |
| audio | long silences | PASS | none |
| sync | speech vs storyboard | PASS | final audio matches the timed voice track exactly (0 frames) |
| sync | audio vs video length | PASS | audio 22.848 s, video 22.867 s |
| layout | captions in safe area | PASS | word captions stay inside the 4 % margin |
| layout | captions off faces | PASS | no caption covers a face |
| layout | speaker face in frame | PASS | speaker faces are never cut while talking |
| rhythm | storyboard lint | PASS | 11 shots, avg 2.08 s, speaker on screen 95 % |

## Look at these images

- One frame per shot: `build/qa/shots.png`
- Contact sheet: `build/qa/sheets/sheet_01.png`
- Contact sheet: `build/qa/sheets/sheet_02.png`

## Manual checklist (any model or person; see SKILL.md step 9)

- [ ] Text readable at phone size, nothing cut off
- [ ] No face cut by the frame edge, no caption over a face
- [ ] Mouth moves only while that character speaks
- [ ] Every cut feels motivated (speaker change, reaction, cutaway); no two identical shots in a row
- [ ] Reactions start just before the word they react to
- [ ] Music never covers the voice; ending does not clip

Disk: build/ 23.4 MB, out/ 7.5 MB. `da clean` removes build/tmp; `da clean --all` removes build/.
