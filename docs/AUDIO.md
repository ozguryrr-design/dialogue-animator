# Audio: timing, voice, music, mix

## Timing sources (in this order)
1. **`words.json`** given by you: exact. Shapes: `[{word,start,end}]`, `{words:[…]}`, `{lines:[{index, words:[…]}]}` (per-line files, times inside each file), or whisper-style `{segments:[{words:[…]}]}`. Words are matched to the script with sequence alignment, so small spelling differences are fine.
2. **One audio file per line** (`audio/01_deniz.wav`, `02_su.wav`, …): **recommended**. Durations come from the decoded sample count (ffprobe is never needed). Leading and trailing silence is trimmed (`timing.trimSilence`). Lines are placed with `timing.gap` (0.25 s, ×0.6 when the same person continues) plus any `@pause`. Word times inside a line are estimated from syllable weights and snapped to energy dips. Set `timing.wordTiming: "whisper"` to transcribe each file for exact word times.
3. **One voice file + whisper**: if `faster-whisper` (Python) or the `whisper` CLI is installed, word timestamps are aligned to the script (Needleman–Wunsch on accent-folded words). The output reports how many words matched, e.g. "25/25 script words matched".
4. **One voice file, no whisper**: speech segments are found by silence detection (≥ 0.25 s at −24 dB below the speech level). They are merged or split until there is one per line, guided by the expected length of each line.
5. **No audio**: line durations are **estimated** at `timing.speechRate` (4.6 syllables/s) plus small punctuation pauses. Every report and the QA say "ESTIMATED". The video has no voice, so captions are switched on.

### Timed beats
When the dialogue has beats (`0–5 sn — …`), every line is placed inside its beat's window instead of back to back. With **one recording**, the file is cut into one clip per line first: whisper word times (or `words.json`) are aligned to the script, and cut points are put at the quietest moment between two lines. The clips are then placed into the windows, so a 15 s recording can fill a 30 s timed script with its pauses. Per-line files are placed the same way. Without audio, estimated durations are placed.

Install whisper (optional): `pip install faster-whisper`. The first run downloads the model (≈150 MB for `base`). Choose another with `timing.whisperModel`.

## Mouth
`build/envelope.json` holds per-speaker mouth openness per frame (0–100) from the placed voice: RMS per frame, normalized to the line's 90th percentile, instant attack, about 2-frame release, gated to the line. Without audio, the mouth opens and closes once per vowel of each word.

## Babble voice (no recording needed)
`"voice": "babble"` in project.json (or `da babble <dir> --into audio`) synthesizes one gibberish line per utterance. Each syllable of the real text becomes a sung vowel with that vowel's formants, so rhythm, word timing and mouth shapes follow the script. Pitch, formant shift and speed are derived from the character id (never from a guessed gender). No samples or TTS are involved, so there are no licence questions. The example project uses it.

## Music
- `own`: your file from `music/` (looped and trimmed).
- `synth` (default): `src/audio/music.mjs` writes an original piece from code and a seed. It has a pad, bass, a plucked lead (kalimba, marimba, bell or synth, chosen by the style pack), light percussion, an intro bar and an ending on the tonic. Mood, tempo and scale come from the style pack (`music`) or `project.json`. It uses no samples and no third-party material, so it falls under this repository's MIT licence.
- `none`.

## Sound effects
Two kinds, mixed the same way: `da mix` renders them into `build/sfx.wav` at `mix.sfxDb` (default 0). They are not ducked, because they are part of the action.

- **Yours:** any file in `sfx/` (or `"sfxDir"`), cued in the script with `@sfx name [time] [±NdB]` (docs/PROJECT_FOLDER.md). Each file is peak-matched first, then the cue's gain applies.
- **Built-in:** `src/audio/sfx.mjs` synthesizes `door`, `bolt`, `clink`, `knock` and `whoosh` from code (no samples). You can cue them yourself, and the director places them from beat actions.

A file named after a built-in replaces it everywhere, including in beat actions. Without a time, a cue plays 0.15 s before the next line.

## Mix chain (src/audio/mix.mjs)
1. Measure each stem with ebur128. Voice gain → −16 LUFS; music gain → voice + `mix.musicDb` (−13 dB).
2. Music: fade in 0.5 s, fade out over the last 1.8 s. With a fade to black in the picture, the music fades out together with it. Padded or trimmed to the exact video length.
3. **Ducking**: `sidechaincompress` keyed by the voice (threshold 0.015, ratio ≈ 1 + |duckDb|/2, attack 20 ms, release 320 ms).
4. `amix` of voice, ducked music and sound effects (no normalization). If the voice is very dynamic (peak-to-loudness above what −14 LUFS / −2 dBTP allows), a look-ahead `alimiter` shaves just the excess peaks first; the mix reports by how many dB. Then two-pass `loudnorm` (I = −14 LUFS, TP = −2 dBTP, LRA = 11, linear) → 48 kHz.
5. If the true peak is still above target, the whole mix is turned down (AAC adds about 0.3 dB).
6. Mux: video stream copied, AAC 192 kb/s 48 kHz, exact duration.

The QA expects −14 ± 1 LUFS and a true peak ≤ −1 dBTP in the final mp4.
