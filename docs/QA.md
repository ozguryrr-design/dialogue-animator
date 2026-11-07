# QA

`da qa <dir>` checks the finished mp4 against the storyboard. It writes `build/qa/report.md` (human), `report.json` (machine), `shots.png` (one frame per shot) and `sheets/sheet_NN.png` (every 10th frame, labelled with frame, time and shot). The exit code is 1 on FAIL.

| group | check | pass when |
|---|---|---|
| specs | video stream, audio stream, duration | resolution and fps match the storyboard; AAC 48 kHz; duration within 2 frames |
| frames | black frames | no frame with mean luma < 0.04 |
| | white frames | none with mean luma > 0.94 outside planned transitions |
| | frozen spans | no run of ≥ 12 identical frames (mean RGB difference < 0.02); every hold must creep |
| | unplanned pops | no frame difference above max(10, 4× local median + 3) outside cuts, transitions, expression changes and gestures |
| audio | loudness / true peak / silences | −14 ± 1 LUFS; ≤ −1 dBTP; no silence longer than 2 s |
| sync | speech vs storyboard | the cross-correlation between the final audio's envelope and the storyboard's line intervals peaks at a lag within ±1 frame |
| | audio vs video length | within 1.5 frames |
| layout | captions in safe area | the caption box stays 4 % inside every edge in every frame |
| | captions off faces | no caption box covers a visible face circle |
| | speaker face in frame | while someone talks in a shot that includes them, their face is less than 10 % outside the frame |
| rhythm | storyboard lint | shot lengths, repeated framings, static holds, singles in a row, speaker share, reaction lead, caption reading speed |

The layout checks need no pixels: they use the same geometry the renderer uses (`frameLayout` in `src/engine/render.mjs`). Agents without image input still get reliable answers.

## Manual checklist (if you can see images)
Review `shots.png` and the sheets:
- [ ] Text readable at phone size; nothing cut off or overflowing
- [ ] No face cut by the frame edge; no caption over a face
- [ ] Mouths move only while that character speaks
- [ ] Each cut is motivated; no identical shots back to back
- [ ] Reactions land just before their word
- [ ] Music never covers the voice; the ending is not clipped

**Before "fixing" a crop seen in a small thumbnail**, render that moment at full size (`da stills <dir> --t 4.8 --scale 1`). Thumbnails exaggerate how tight a framing is (TROUBLESHOOTING #10).

## Optional second reviewer
If your agent can start a sub-agent, give it `shots.png`, one sheet and the checklist above, and ask for a short verdict with frame numbers. This is an extra check. The automatic QA does not depend on it.
