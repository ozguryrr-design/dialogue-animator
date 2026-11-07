# dialogue-animator

**Write a dialogue, get an animated video.** Put a `dialogue.md` in a folder, optionally with recordings, character notes and music, and this skill stages it. It produces 2D characters, camera work, lip-sync, expressions, gestures, captions, an original music bed, a broadcast-loudness mix and an automatic QA report. Default output: 9:16, 1080×1920, 30 fps, H.264 + AAC.

It is an **agent skill that works with any model or agent**: Claude Code, Codex, Gemini CLI, Cursor, or you in a terminal. The instructions are plain Markdown (`SKILL.md`, `AGENTS.md`), the data is JSON with JSON Schema, and every step is a CLI command. It runs locally with Node and ffmpeg and needs no browser or cloud service.

![One frame per shot of the example video](examples/cay-krizi/output/shots.png)

*Example: [`examples/cay-krizi`](examples/cay-krizi), a 23 s Turkish dialogue in the default "Kesik Kâğıt" (paper cut) style. 11 shots, two scenes, per-line audio, synthesized music, QA: PASS. Video: [`output/cay-krizi_540p.mp4`](examples/cay-krizi/output/cay-krizi_540p.mp4).*

## Quick start (5 minutes)

You need **Node.js 20+** and **ffmpeg** (`winget install Gyan.FFmpeg` · `brew install ffmpeg` · `sudo apt install ffmpeg`, or `pip install imageio-ffmpeg`).

```bash
git clone <this-repo-url> dialogue-animator
cd dialogue-animator
npm install
node bin/da.mjs doctor                       # checks Node, canvas, ffmpeg, fonts
node bin/da.mjs make examples/cay-krizi      # renders the example (~15 s on a laptop)
```

The video lands in `examples/cay-krizi/out/cay-krizi.mp4`, and the QA report in `examples/cay-krizi/build/qa/report.md`.

Your own video:

```bash
node bin/da.mjs init my-video     # starter folder: dialogue.md, project.json, characters/
# edit my-video/dialogue.md  ->  Name: line
node bin/da.mjs doctor my-video
node bin/da.mjs make my-video
```

**Tip:** for exact lip-sync and timing, record **one audio file per line**: `audio/01_ali.wav`, `audio/02_su.wav`, … A single file also works (with whisper or silence detection), and so does no audio at all (timing is then estimated and clearly flagged). See [docs/AUDIO.md](docs/AUDIO.md).

## Use it as a skill
- **Claude Code**: copy or clone this folder to `~/.claude/skills/dialogue-animator/` (or a project's `.claude/skills/`). Then ask for "an animated dialogue video from my-video/".
- **Other agents** (Codex, Gemini CLI, Cursor, Aider …): point them at this folder. `AGENTS.md` tells them to follow `SKILL.md`.
- The skill asks at most 5 short questions (style, format, captions, music, character descriptions), each with a default. Agents that cannot ask read `project.json` or use the defaults, and every assumption is written to `build/decisions.md`.

## The project folder
```
my-video/
  dialogue.md     Ali: Is the tea gone? [surprised]       ← required
  audio/          01_ali.wav, 02_su.wav …  or one file     ← optional
  characters/     ali.md "tall, curly ginger hair, glasses" or ali.png / ali.json
  music/          one file you own                         ← optional (otherwise synthesized)
  project.json    {"style": "jole", "format": "16:9", "captions": "line"}
```
Full format: [docs/PROJECT_FOLDER.md](docs/PROJECT_FOLDER.md). Any language works; `doctor` checks that the fonts cover every character you used.

## Styles
Three original style packs ship. All of them are measurable and switchable, and you can write your own ([docs/STYLE_PACK.md](docs/STYLE_PACK.md)).

| `kesik-kagit` (default) | `jole` | `riso-cizgi` |
|---|---|---|
| ![Paper cut](styles/kesik-kagit/preview/sheet.png) | ![Gummy pop](styles/jole/preview/sheet.png) | ![Riso line](styles/riso-cizgi/preview/sheet.png) |
| Cut paper, no outlines, layer shadows, characters on twos | Thick outlines, glossy blobs, squash-and-stretch, punch-ins | Blue monoline, off-register pink and yellow, halftone |

```bash
node bin/da.mjs styles                              # list
node bin/da.mjs style new my-look --from jole       # copy and edit numbers
node bin/da.mjs style check my-look                 # contrast, colour count, limits, Turkish glyphs
node bin/da.mjs style preview my-look               # preview sheet
```

## How it works
```
dialogue.md ─parse─▶ dialogue.json ─cast─▶ characters.json
audio/ ─────align─▶ timing.json + voice.wav + mouth envelopes
                      └──────────── board (director) ─▶ storyboard.json ◀── the only input a renderer needs
                                                             │
          render (Canvas2D in Node; frames piped to ffmpeg) ─┤─ preview (same engine in a browser)
                                                             │
                       mix (music ducked, −14 LUFS) ─▶ out/<title>.mp4 ─▶ qa (report + contact sheets)
```
- **Story is separate from the renderer.** The director writes `storyboard.json` (scenes, cast positions, shots, camera moves, expression/gesture/reaction events, mouth tracks, captions), and the renderer only reads it. A pure `renderFrame(ctx, env, t)` runs unchanged in Node (`@napi-rs/canvas`), a browser preview, or Playwright ([docs/RENDERERS.md](docs/RENDERERS.md)).
- **Everything is timed to words.** Cuts land 4 frames before the speaker's first syllable, and listeners react 4 frames before the word they react to. No hold is static, a framing is never repeated back to back, and long lines get reaction cuts ([docs/DIRECTING.md](docs/DIRECTING.md)).
- **QA any model can read**: black, white and frozen frames, pops, loudness, true peak, audio/storyboard sync in frames, captions in the safe area and off faces, speaker faces never cut, and shot rhythm. Contact sheets are made for models that can see images ([docs/QA.md](docs/QA.md)).

## Commands
| | |
|---|---|
| `doctor [dir]` | check tools, fonts and a project folder |
| `init <dir>` | starter project |
| `parse` · `cast` · `align` · `board` | the pipeline steps (each writes JSON in `build/`) |
| `stills <dir> [--t 1.5,4] [--scale 1]` | one PNG per shot (or per time) + a sheet |
| `render <dir> [--scale 0.5] [--workers 6]` | the picture (no frame folders on disk) |
| `music` · `mix` | original music bed; ducking, loudness, mux |
| `qa <dir>` | report + sheets; exit code 1 on FAIL |
| `make <dir>` | everything above, non-interactive |
| `babble <dir>` | gibberish voice per line when there is no recording |
| `preview <dir>` | live preview in a browser |
| `compare --a … --b …` · `sheet <video>` · `clean <dir>` | review and housekeeping tools |

Run them as `node bin/da.mjs …`, or `npm link` once and use `da …`.

## Docs
[PROJECT_FOLDER](docs/PROJECT_FOLDER.md) · [QUESTIONS](docs/QUESTIONS.md) · [CHARACTERS](docs/CHARACTERS.md) · [DIRECTING](docs/DIRECTING.md) · [AUDIO](docs/AUDIO.md) · [STYLE_GUIDE](docs/STYLE_GUIDE.md) · [STYLE_PACK](docs/STYLE_PACK.md) · [STORYBOARD_SCHEMA](docs/STORYBOARD_SCHEMA.md) · [RENDERERS](docs/RENDERERS.md) · [QA](docs/QA.md) · [TROUBLESHOOTING](docs/TROUBLESHOOTING.md)

## Licence and assets
- Code and docs: **MIT** ([LICENSE](LICENSE)).
- Fonts: Baloo 2, Fraunces and Noto Sans, **SIL OFL 1.1**, unmodified, with their licences in `fonts/`.
- Characters, sets, props, symbols, the example's voice (babble synthesis) and all music are **generated by code in this repository**. There are no samples, stock art or third-party characters. The style packs are original directions, not copies of any channel or brand.
- Music or voices you add yourself remain your responsibility.

---

## Türkçe hızlı başlangıç

**Diyaloğu yaz, animasyonlu videoyu al.** Bir klasöre `dialogue.md` koymanız yeterli; ses kaydı, karakter tarifi ve müzik isteğe bağlı. Sahneler, kamera, ağız senkronu, ifadeler, altyazı, müzik, ses miksajı ve kalite kontrolü otomatik yapılır.

```bash
npm install
node bin/da.mjs doctor                       # eksikleri açıkça söyler
node bin/da.mjs make examples/cay-krizi      # örnek videoyu üretir
node bin/da.mjs init benim-videom            # kendi projen için başlangıç klasörü
```

- **Diyalog:** her satıra `İsim: cümle`. `[şaşkın]` ifadeyi, `(omuz silker)` jesti belirler, `## Mutfak` yeni sahne açar.
- **Ses:** en iyisi satır başına bir dosya (`audio/01_ali.wav`, `02_su.wav` …). Tek dosya ve sessiz kullanım da olur (zamanlama tahmini olur ve raporda belirtilir).
- **Karakter:** `characters/ali.md` içine "uzun boylu, kıvırcık kızıl saçlı, gözlüklü" gibi bir tarif yazın; yoksa diyalogdan otomatik üretilir.
- **Ayarlar:** `project.json` içinde `{"style": "jole", "format": "16:9", "captions": "line", "music": "synth"}`. Sorulmayan her şeyin varsayılanı vardır; kullanılanlar `build/decisions.md` dosyasına yazılır.
- **Stiller:** `kesik-kagit` (varsayılan), `jole`, `riso-cizgi`. Kendi stilinizi `node bin/da.mjs style new benim-stilim --from kesik-kagit` ile türetebilirsiniz.
