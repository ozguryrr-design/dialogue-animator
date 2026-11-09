# The project folder

Only `dialogue.md` (or `.txt` / `.json`) is required. Everything else is optional and has a default. `da init <dir>` prepares the folders below and leaves any script alone; `--sample` adds a sample script to try.

```
my-video/
  dialogue.md        who says what
  audio/             voice, narration included: one file per line (best) or one file for everything
  sfx/               your sound effects, cued in the script with @sfx
  characters/        <id>.md description · <id>.png/.jpg image · <id>.json exact parameters
  music/             one music file you have the rights to
  words.json         word timings, if you already have them
  project.json       answers to the questions; `da answer` writes it (docs/QUESTIONS.md)
  design.json        sets and costumes; the agent writes it (docs/DESIGN.md)
  styles/<id>/       optional project-local style pack
  build/             generated (safe to delete)
  out/               the finished video
```

## dialogue.md

```markdown
# Tea Crisis                         ← first "# heading" = title

## Kitchen                           ← "## heading" = new scene; its words choose the set
Deniz: Good morning! Did you make tea?
Su: (shrugs) I did... but it's gone. [sad]
Deniz: What?! The whole box?
@pause 0.8                           ← extra silence before the next line (seconds)
Su: Relax. I have a plan. [smug]

## Cafe
Su: My plan: the cafe on the corner!
```

- **One utterance per line**: `Name: text`. `**Name:** text` and `- Name: text` also work. Names may be written in any case (`ALİ`, `Ali`), and Turkish casing is handled. A line without `Name:` continues the previous line.
- **`[tag]`** sets the expression: `neutral, happy, laugh, sad, angry, surprised, scared, thinking, worried, smug`. Turkish and English synonyms work (`[şaşkın]`, `[üzgün]`, `[kendinden emin]`, `[excited]` …; full list in `src/project/lexicon.mjs`). Without a tag the expression is guessed from words and punctuation.
- **`(direction)` or `*direction*`** is not spoken. It can trigger a gesture (`waves / el sallar`, `points`, `shrugs / omuz silker`, `facepalm / yüzünü kapatır`, `cheers / sevinir`, `explains`, `thinks`, `nods`) or an expression (`sighs`, `laughs`, `shouts`, `whispers` …).
- **Scenes**: `## Kitchen`, `@scene: park` or `[scene: office]`. Recognised sets include `kitchen, cafe, living-room, office, street, park, palace, throne-room, classroom, schoolyard, hospital, bazaar, forest, mountain, beach, desert, village` (Turkish words too: mutfak, kafe, salon, ofis, sokak, saray, sınıf, hastane, pazar, orman, dağ, sahil, köy …; all of them: `da design --catalog`). Unknown words fall back to the dialogue's content, then to `living-room`.
- HTML comments `<!-- -->`, `//` lines and `>` quotes are ignored.
- Any language works. `da doctor` checks that the style's fonts contain every character you used.

### Narration (dış anlatım)
```markdown
@narrator Grandpa                    ← only for a name that is not built in
## Park
Anlatıcı: Nobody had been here in years.
@cast Ali, Su                        ← on stage even if they do not speak
Grandpa: Except, that morning, two children.
Ali (dış ses): I knew it was a bad idea.
Ali: Is that a key?
```

- Built-in narrator names: Anlatıcı, Dış Ses, Dış Anlatım, Dış Anlatıcı, Hikâye Anlatıcısı, Narrator, Voiceover, VO, Storyteller. Each one is heard, has no character and takes no place on stage.
- `Ali (dış ses):`, `(V.O.)`, `(voice-over)`, `(off-screen)`, `(ekran dışı)`: Ali stays a character, but this line is only heard. His mouth stays closed.
- Narration needs a name in front. A line without `Name:` continues the previous line.
- Narration is an ordinary line for timing: with per-line audio it gets its own numbered file, in script order, and its captions are shown like any other line.
- A scene with only narration has an empty stage, and the camera looks around the set. `@cast` (or `@sahnede`) puts people on it.

### A story with no speech

Timed directions alone are enough, if the script says who is in it:

```
@cast Hoca, Komşu

0–5 sn — Hoca kazanı kapının önüne bırakır.
5–10 sn — Komşu tencereyi çıkarır.
```

The agent then stages it in `staging.json` (docs/STAGING.md).

### Sound effects in the script
```markdown
@sfx thunder                 ← just before the next line
@sfx thunder 12.5            ← at 12.5 s (also 1:05)
@sfx thunder -3dB            ← 3 dB quieter
@sfx gök gürültüsü 12.5 -3dB
```

`@efekt` and `@ses` work too. The name is looked up in `sfx/` first, ignoring case, accents and the difference between spaces and dashes, then among the built-ins (`door`, `bolt`, `clink`, `knock`, `whoosh`, or kapı, sürgü, kilit, tıkırtı, kâse, tıklama, hışırtı). In a beat with no line after it, the cue plays at the start of the beat; after the last line, 0.2 s after it. A name that cannot be found stops `da next` and fails `da doctor` before anything is rendered.

### Timed scripts (beats)
A line that starts with a time range opens a **beat**. The text after the dash is a stage direction, and the lines that follow are placed inside that window:

```markdown
0–5 sn — İftar bitmiş. Süleyman kâsesini sofraya bırakır.
Süleyman: “Seferde sana ‘sultan’ demişler, İbrahim.”

14–19 sn — İbrahim bakışını indirip ayağa kalkar.
İbrahim Paşa: “Müsaadenizle konağıma döneyim, hünkârım.”

24–30 sn — Kapı kapanır. Sürgünün sesiyle ekran kararır.
```

- Accepted forms: `0–5 sn — …`, `5-10 s: …`, `[0:05–0:10] …`, `@at 12-15: …`, `@at 12.5`. The total length becomes the end of the last beat, even if nothing is spoken in it.
- Lines are placed after the beat's actions have time to start. If a line is longer than its window, `align` says by how much.
- A line written as a quotation (“…”) is spoken without the outer quote marks.
- Directions become **actions** for whoever is named first in the sentence (`src/project/lexicon.mjs` ACTIONS, Turkish and English):

| words (examples) | action |
|---|---|
| ayağa kalkar · stands up / oturur · sits down | posture change. A character who stands up later starts seated; sofra, iftar or dinner seats everyone, and a low table is added in front of them. |
| bırakır · koyar · puts down | reach to the table; a bowl appears with a clink |
| gözünü … ayırmaz · stares | stern expression, no blinking during the beat |
| bakışını indirir · looks down | downcast expression |
| kapı kapanır / açılır · door closes / opens | a door in the set closes or opens, with a thud; a beat with no speech shows it in an insert |
| sürgü · kilit · bolt · locks | a bolt sound |
| ekran kararır · fade to black | fade to black (stays black to the end) |
| el sallar · omuz silker … | the usual gestures |

`gece`, `iftar`, `akşam` or `night` darkens the set (night tint), while the characters stay lamp-lit.

`dialogue.json` alternative: `{"title": "…", "lines": [{"speaker": "Deniz", "text": "…", "emotion": "happy", "scene": "Kitchen", "pause": 0.5, "voiceOver": false}], "sfx": [{"name": "thunder", "at": 12.5, "gainDb": -3}]}`. A cue without `at` takes `"beforeLine": 3`; `"narrator": true` on a line marks its speaker as a narrator.

## audio/

| what you put there | what happens |
|---|---|
| `01_deniz.wav`, `02_su.wav`, … one file per line | **Most reliable.** Exact line times from the decoded audio; silence at the ends is trimmed; files are matched by their number (0- or 1-based), counting every spoken line, narration included. A name that does not match the speaker gives a warning, and a file that matches no line is reported. |
| one file with the whole dialogue | Lines found with whisper word timestamps (if installed) or by silence detection. |
| nothing | Timing is **estimated** from syllable counts; the video has music but no voice; captions are forced on. |

Any format ffmpeg reads works: wav, mp3, m4a, ogg, flac, opus, webm and more. If your files are in another folder, set `"audioDir": "my-folder"` in project.json. `doctor` points this out when it finds audio elsewhere. See docs/AUDIO.md.

## characters/

File names must match the speaker (`deniz.md` for `Deniz:`; matching ignores case and accents).

- `deniz.md`: a few sentences in Turkish or English, for example "tall, curly ginger hair, mustard sweater, round glasses, energetic". It is read by keywords (docs/CHARACTERS.md). An agent should rather write `deniz.json` directly.
- `deniz.png`: its dominant colours become skin, outfit and hair colours.
- `deniz.json`: exact parameters (`schemas/character.schema.json`). This wins over everything else.

## music/

Put one file here. It goes under the voice (ducked, faded), looped if it is shorter than the video. If there are several, the first is used and `doctor` warns; pick another with `"music": {"mode": "own", "file": "music/x.mp3"}`. Only use music you have the rights to. Without a file the default is an original score synthesized by code; `da answer <dir> --music none` turns music off (docs/AUDIO.md).

## sfx/

Any format ffmpeg reads. The file name is the cue name: `sfx/thunder.wav` is `@sfx thunder`. Each file is level-matched by its peak, then the cue's `-3dB` applies. A file named after a built-in sound (`door.wav`, `kapi.mp3`, `bolt.wav`, …) replaces it, including where a timed script would have used it automatically (`Kapı kapanır.`). Only use sounds you have the rights to. Keep them somewhere else with `"sfxDir": "my-sounds"` in project.json.
