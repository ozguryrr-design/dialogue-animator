# The project folder

Only `dialogue.md` (or `.txt` / `.json`) is required. Everything else is optional and has a default.

```
my-video/
  dialogue.md        who says what
  audio/             voice: one file per line (best) or one file for everything
  characters/        <id>.md description · <id>.png/.jpg image · <id>.json exact parameters
  music/             one music file you have the rights to
  words.json         word timings, if you already have them
  project.json       answers to the questions (docs/QUESTIONS.md)
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
- **Scenes**: `## Kitchen`, `@scene: park` or `[scene: office]`. Recognised sets: `kitchen, cafe, living-room, office, street, park, studio` (Turkish words too: mutfak, kafe, salon, ofis, sokak, park, bahçe …). Unknown words fall back to the dialogue's content, then to `living-room`.
- HTML comments `<!-- -->`, `//` lines and `>` quotes are ignored.
- Any language works. `da doctor` checks that the style's fonts contain every character you used.

`dialogue.json` alternative: `{"title": "…", "lines": [{"speaker": "Deniz", "text": "…", "emotion": "happy", "scene": "Kitchen", "pause": 0.5}]}`.

## audio/

| what you put there | what happens |
|---|---|
| `01_deniz.wav`, `02_su.wav`, … one file per line | **Most reliable.** Exact line times from the decoded audio; silence at the ends is trimmed; files are matched by their number (0- or 1-based). A name that does not match the speaker gives a warning. |
| one file with the whole dialogue | Lines found with whisper word timestamps (if installed) or by silence detection. |
| nothing | Timing is **estimated** from syllable counts; the video has music but no voice; captions are forced on. |

Any format ffmpeg reads works: wav, mp3, m4a, ogg, flac, opus, webm and more. See docs/AUDIO.md.

## characters/

File names must match the speaker (`deniz.md` for `Deniz:`; matching ignores case and accents).

- `deniz.md`: a few sentences in Turkish or English, for example "tall, curly ginger hair, mustard sweater, round glasses, energetic". It is read by keywords (docs/CHARACTERS.md). An agent should rather write `deniz.json` directly.
- `deniz.png`: its dominant colours become skin, outfit and hair colours.
- `deniz.json`: exact parameters (`schemas/character.schema.json`). This wins over everything else.

## music/

The first file is used under the voice (ducked, faded), looped if it is shorter than the video. Only use music you have the rights to. Without a file the default is an original score synthesized by code (docs/AUDIO.md).
