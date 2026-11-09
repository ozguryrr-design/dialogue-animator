---
name: dialogue-animator
description: Turn a folder holding a written dialogue, plus any narration, voice recordings, character notes, sound effects and music the user has, into a finished 2D character animation video. You design sets and costumes that fit the story (a palace and kavuk, a classroom, a forest) and decide what happens on screen (who walks where, what they carry, where the camera follows), even when nobody described them; lip-sync, expressions, captions, mix and QA are automatic. Use when someone wants an animated dialogue or conversation video, a talking-characters short/reel/TikTok, a narrated animated story, "make these characters say this", or hands over a script with speaker names. Works with any model or agent: plain Markdown, JSON and CLI commands.
---

# Dialogue Animator

A folder in, an mp4 out (default 9:16, 1080×1920, 30 fps, H.264 + AAC, −14 LUFS). Runs locally with Node 20+ and ffmpeg.

`da` means `node <the folder containing this file>/bin/da.mjs`.

## The procedure

Repeat until it prints `DONE`:

1. Run `da next <project-folder>`.
2. Do what it printed, and nothing else:

| it printed | what you do |
|---|---|
| `RUN:` | Run that exact command. |
| `Q1:`, `Q2:` … and `THEN RUN:` | Ask the user those questions in one message, in their language, showing each default. Put the answers into the `THEN RUN:` command and run it. If you cannot ask anyone, run the `CANNOT ASK? RUN:` command instead. |
| `DO:` | Do what it says, usually writing a file. If that needs something only the user has, ask for it. If it also prints `CANNOT DESIGN? RUN:` or `CANNOT STAGE? RUN:`, use that only if you really cannot do the work yourself. |
| `DONE` | Give the user the `VIDEO:` file, follow its `DO:` lines, and stop. |

3. If a command fails, read its message and fix what it names (docs/TROUBLESHOOTING.md lists known failures). Then go back to step 1. If `da next` exits with code 2, the user has to do something: tell them what, and stop.

You do not have to plan the pipeline or remember where you are. `da next` works it out from the folder every time and only redoes what changed. `da next <project-folder> --json` prints the same thing as JSON (`state`: run, ask, design, stage, edit, fix, blocked, done; `command`; `instructions`; `answerCommand`; `defaultsCommand`).

## The look is your job

`da next` stops once on a draft of `design.json`. Treat that draft as your brief, not your result, even if the user said nothing about the look:

- From the script, work out the period, place and time of day of each scene, and each character's age, status and job.
- Then dress the world to match. A palace has tiles, lattice windows, lamps and low divans, and a sultan wears a kavuk and a kaftan. A classroom has a blackboard and desks, and a teacher dresses differently from a student. Outdoors has its own sky, ground and plants.
- Use what is ready-made (`da design --catalog`), and draw whatever is missing with simple JSON shapes: docs/DESIGN.md has the format and worked examples. Everything follows the chosen style by itself.
- Anything the user said about the look wins over your own ideas.

## The story is your job too

`da next` stops once more, on a draft of `staging.json`, and prints the script with its times. Two people standing and talking is a failure. Make the story happen:

- Whatever the script says happens must be seen. If a pot is carried in, somebody walks in carrying it, puts it down, and somebody else picks it up.
- People come from somewhere and go somewhere. Start them far apart and have them walk.
- Say where the camera looks, at least every 3 seconds. It is one moving camera that follows whoever it is on; `close` is for the strongest lines only.
- If the story travels, add parts along the route in `design.json`, or a new scene.
- Format and a worked example: docs/STAGING.md.

## What people can bring

Everything goes into one folder. Only the script is required.

| the user has | where it goes | how it works |
|---|---|---|
| Dialogue | `dialogue.md` | One utterance per line: `Ali: Is the tea gone?` |
| Narration (dış anlatım) | `dialogue.md` | `Anlatıcı: It was morning.` or `Narrator: …`. For any other name add `@narrator Name` once. It is heard, nobody on screen says it. `Ali (dış ses): …` is a character who is heard but not seen speaking. |
| Voice recordings | `audio/` | One numbered file per spoken line, narration included, in script order: `01_anlatici.wav`, `02_ali.wav`. One file for everything also works. With none, timing is estimated. |
| Sound effects | `sfx/` | `sfx/thunder.wav` plays where the script says `@sfx thunder` (just before the next line). `@sfx thunder 12.5 -3dB` plays it at 12.5 s, 3 dB quieter. Built in, no file needed: door, bolt, clink, knock, whoosh, step. |
| Music | `music/` | One file they have the rights to. It is looped, faded and ducked under speech. With none, original music is generated. |
| Character looks | `characters/` | `ali.md` (description), `ali.png` (colours only) or `ali.json` (exact). With none, you design them in `design.json`. |

Scene headings, expression tags and every other format detail: docs/PROJECT_FOLDER.md.

## Turning what they said into that folder

Do this before the first `da next`, only for what applies.

| if the user… | then you… |
|---|---|
| names a folder | use it. If they name none, create one in the current directory, named after the story. |
| pastes a script | write it to `dialogue.md` word for word, adding only the `Name:` format. A script alone is enough: start the procedure and it asks for whatever else it needs. |
| gives a script with no speaker names | ask who says each line. Never guess. |
| wants the folders prepared, or has files to add | run `da init <project-folder>`. It makes `audio/`, `sfx/`, `music/`, `characters/` and a README.txt, and leaves any script alone. Tell them what goes where and wait until they say the files are in. |
| tells a story with no speech at all | write it as timed directions (`0–5 sn — Kazanı bırakır.`) and name who is in it with `@cast Hoca, Komşu`. Then stage it in `staging.json`. |
| writes narration as plain paragraphs | put `Anlatıcı:` before each paragraph. A line with no name continues the previous speaker. |
| gives a timed flow (`0–5 sn — Kapı kapanır.`) | keep those lines unchanged in `dialogue.md`. They place the speech in time and act out the directions: sitting, standing, a door, a bolt, a fade to black. |
| gives audio, effects or music | copy them to `audio/`, `sfx/`, `music/`, numbering voice files in script order. To leave a folder where it is: `da answer <project-folder> --audio-dir <folder>` (also `--sfx-dir`, `--music-dir`). |
| wants a sound you have no file for | use a built-in if one fits, otherwise ask for the file. Never swap in a different sound without saying so. |
| describes a character or a place | put it in `design.json` when `da next` gets there, following their words. |
| asks for a look | `da styles` lists them. A new look: docs/STYLE_PACK.md. |
| asks for a change after seeing the video | change `dialogue.md`, `characters/` or the audio, or use `da answer`, then run `da next` again. Do not edit `build/`. |

## Rules
- Never invent or reword the user's script, and never make up audio. No script means asking for one.
- Whenever the output says the timing is ESTIMATED, tell the user.
- Keep the look original. Do not imitate an existing channel, show, brand or character, even on request; offer a new style pack instead.
- Only the user's own files, the bundled OFL fonts and code-generated art and music go into the video.

## Optional, if you are able to
- See images: run `da stills <project-folder>` before the render step and open `build/stills/sheet.png`; after QA, open `build/qa/shots.png` and use the checklist in docs/QA.md.
- Skip the loop when every default is fine: `da make <project-folder>` runs the whole pipeline without questions.
- If your agent can start a sub-agent, it may review those images independently. This is optional.

## Docs (open one only when you need it)
- docs/PROJECT_FOLDER.md: input formats
- docs/DESIGN.md: sets and costumes, drawing your own
- docs/STAGING.md: what happens, who moves, where the camera goes
- docs/QUESTIONS.md: every setting and default
- docs/CHARACTERS.md, docs/DIRECTING.md, docs/AUDIO.md
- docs/STYLE_GUIDE.md, docs/STYLE_PACK.md: the look, and writing your own
- docs/STORYBOARD_SCHEMA.md, docs/RENDERERS.md: internals
- docs/QA.md, docs/TROUBLESHOOTING.md: checks and known failures (add new ones there)
