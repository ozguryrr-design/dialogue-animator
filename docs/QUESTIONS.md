# Questions, defaults and project.json

The skill works interactively **and** non-interactively:

1. `da next` prints the questions that the folder does not already answer: all in one message, in the user's language, each with its default shown. The agent puts the answers into the `da answer` command it prints, which validates them and writes `project.json`. Nobody has to write JSON by hand. If the folder has no voice, effects or music yet, it also asks whether the user has any to add; if so, `da init` prepares the folders and the agent waits for the files.
2. If it cannot ask (a batch run, CI, an agent without user turns), it runs the printed `da answer <dir> --defaults`.
3. If a value is still missing, it uses the default. Every command writes `build/decisions.md` with **value + source** (`cli`, `project.json`, `auto`, `default`) and the reason. The agent puts that table in its final report.

## The questions

| # | question | `project.json` | default | notes |
|---|---|---|---|---|
| 1 | Which style? | `"style": "kesik-kagit"` | `kesik-kagit` | `jole`, `riso-cizgi`, a custom pack id, or a path to a folder with `style.json`. Show `styles/<id>/preview/sheet.png` if you can show images. |
| 2 | Format? | `"format": "9:16"` | `9:16` (1080×1920) | `16:9` (1920×1080), `1:1`, `4:5`; `"width"` changes the resolution. |
| 3 | Captions? | `"captions": "word"` | `word` | `word` = one word (or a short pair) at a time; `line` = subtitle pages with the spoken word highlighted; `bubble` = speech balloon at the speaker (hidden while the speaker is off-screen); `none`. With no voice, `none` becomes `word`. |
| 4 | Music? | `"music": "synth"` | `synth` (or `own` if `music/` has a file) | `own` uses `music/` (or `{"mode": "own", "file": "…"}`); `none`; `{"mode": "synth", "mood": "playful", "tempo": 110}`. |
| 5 | Describe the characters? | `"characters": {"describe": true}` | generated | If yes, collect appearance, colours, personality and accessories per character into `characters/<id>.md` (or better, `<id>.json`). |

Never asked, but available:

```json
{
  "voice": "auto",
  "audioDir": "audio",
  "musicDir": "music",
  "timing": { "wordTiming": "auto", "whisperModel": "base", "leadIn": 0.4, "tail": 1.0, "gap": 0.25, "trimSilence": true, "speechRate": 4.6 },
  "fps": 30,
  "seed": 7,
  "language": "auto",
  "output": "out/my-video.mp4",
  "quality": { "crf": 18, "preset": "medium" },
  "mix": { "lufs": -14, "truePeak": -2, "musicDb": -13, "duckDb": -8, "sfxDb": 0 },
  "director": { "minShot": 0.8, "maxShot": 4.5, "cutaways": true, "reactions": true },
  "characters": { "overrides": { "su": { "colors": { "body": "teal" }, "accessories": ["scarf"] } } }
}
```

- `director.camera`: `follow` (default) is one moving camera per scene that tracks the action; `cut` gives separate static shots with hard cuts.
- `voice`: `auto` uses `audio/` when present; `babble` synthesizes a gibberish voice per character (useful for drafts or when no recording exists); `none` means silent.
- `seed` changes blinks, music and small variations. The same seed always gives the same video.

`da answer <dir>` takes `--style --format --captions --music --voice --mood --tempo --title --audio-dir --sfx-dir --music-dir` and keeps what is already there; `--defaults` only fills in what is missing. For everything else, edit `project.json`.

CLI flags override `project.json` for one run: `--style`, `--format`, `--captions`, `--music`, `--voice`, `--seed`.
