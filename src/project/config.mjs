// Project discovery + configuration. Every answer has a default, and every resolved value is
// recorded with its source (project.json / cli / auto / default) in build/decisions.md, so a
// non-interactive agent can report exactly what it assumed.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, exists, isDir, writeText, ensureDir } from '../lib/util.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { slug } from '../lib/text.mjs';

export const AUDIO_EXT = ['.wav', '.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.webm', '.wma', '.aif', '.aiff'];
export const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];

export const DEFAULTS = {
  style: 'kesik-kagit',
  format: '9:16',
  width: null,
  fps: 30,
  captions: 'word',
  music: 'synth',
  voice: 'auto',
  characters: { describe: false, overrides: {} },
  timing: { wordTiming: 'auto', whisperModel: 'base', leadIn: 0.4, tail: 1.0, gap: 0.25, trimSilence: true, speechRate: 4.6 },
  language: 'auto',
  seed: 7,
  output: null,
  quality: { crf: 18, preset: 'medium' },
  mix: { lufs: -14, truePeak: -2, musicDb: -13, duckDb: -8 },
  director: { minShot: 0.8, maxShot: 4.5, cutaways: true, reactions: true, camera: 'follow' },
};

export const FORMATS = { '9:16': [1080, 1920], '16:9': [1920, 1080], '1:1': [1080, 1080], '4:5': [1080, 1350] };

const listFiles = (dir, exts) => (isDir(dir)
  ? fs.readdirSync(dir).filter((f) => exts.includes(path.extname(f).toLowerCase()) && !f.startsWith('.')).sort(naturalCompare).map((f) => path.join(dir, f))
  : []);

export function naturalCompare(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/** What the user put in the project folder. Nothing here is required except a dialogue file. */
export function scanProject(dir) {
  const abs = path.resolve(dir);
  const pick = (names) => names.map((n) => path.join(abs, n)).find(exists) || null;
  const pj = pick(['project.json']);
  let audioDir = 'audio', musicDir = 'music', sfxDir = 'sfx';
  if (pj) { try { const j = readJSON(pj); audioDir = j.audioDir || audioDir; musicDir = j.musicDir || musicDir; sfxDir = j.sfxDir || sfxDir; } catch { /* reported by loadConfig */ } }
  // folders that contain audio but are not the configured ones (doctor suggests "audioDir")
  const otherAudioDirs = isDir(abs) ? fs.readdirSync(abs).filter((d) => isDir(path.join(abs, d)) && ![audioDir, musicDir, sfxDir, 'build', 'out', 'node_modules', 'styles'].includes(d) && listFiles(path.join(abs, d), AUDIO_EXT).length) : [];
  return {
    dir: abs,
    dialogue: pick(['dialogue.md', 'dialogue.txt', 'dialogue.json', 'dialog.md', 'dialog.txt', 'dialog.json', 'diyalog.md', 'diyalog.txt']),
    projectJson: pj,
    words: pick(['words.json', path.join(audioDir, 'words.json')]),
    audioDir,
    otherAudioDirs,
    audio: listFiles(path.join(abs, audioDir), AUDIO_EXT),
    characters: isDir(path.join(abs, 'characters'))
      ? fs.readdirSync(path.join(abs, 'characters')).filter((f) => /\.(md|txt|json)$/i.test(f) || IMAGE_EXT.includes(path.extname(f).toLowerCase())).sort(naturalCompare).map((f) => path.join(abs, 'characters', f))
      : [],
    music: listFiles(path.join(abs, musicDir), AUDIO_EXT),
    sfxDir,
    sfx: listFiles(path.join(abs, sfxDir), AUDIO_EXT),
    build: path.join(abs, 'build'),
    out: path.join(abs, 'out'),
  };
}

const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b === undefined ? a : b;
  const o = { ...(a || {}) };
  for (const [k, v] of Object.entries(b)) o[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? merge(a?.[k], v) : v;
  return o;
};

/**
 * Resolve the configuration. `cli` holds overrides from command-line flags (style, captions, format, music, voice, seed).
 * Returns { cfg, decisions, files }.
 */
export function loadConfig(dir, cli = {}) {
  const files = scanProject(dir);
  let user = {};
  if (files.projectJson) {
    user = readJSON(files.projectJson);
    const { valid, errors } = validate(user, loadSchema('project'));
    if (!valid) throw new Error(`project.json is invalid:\n${errors.slice(0, 10).map((e) => '  - ' + e).join('\n')}`);
  }
  const decisions = [];
  const cfg = merge(DEFAULTS, user);
  const note = (key, value, source, why = '') => decisions.push({ key, value, source, why });
  const src = (key) => (cli[key] !== undefined ? 'cli' : (user[key] !== undefined ? 'project.json' : 'default'));

  for (const k of ['style', 'format', 'captions', 'voice', 'fps', 'seed']) if (cli[k] !== undefined) cfg[k] = k === 'fps' || k === 'seed' ? +cli[k] : cli[k];
  if (cli.music !== undefined) cfg.music = cli.music;

  // music: string or object -> object
  let music = typeof cfg.music === 'string' ? { mode: cfg.music } : { mode: 'synth', ...cfg.music };
  let musicSource = src('music');
  if (musicSource === 'default' && files.music.length) { music.mode = 'own'; musicSource = 'auto'; }
  if (music.mode === 'own') {
    const f = music.file ? path.resolve(files.dir, music.file) : files.music[0];
    if (!f || !exists(f)) { note('music', 'synth', 'auto', 'music: "own" was requested but no file was found in music/ — synthesizing instead'); music = { ...music, mode: 'synth' }; }
    else music.file = f;
  }
  cfg.music = music;
  if (!decisions.find((d) => d.key === 'music')) note('music', music.mode + (music.file ? ` (${path.basename(music.file)})` : ''), musicSource, music.mode === 'own' && musicSource === 'auto' ? 'a file was found in music/' : '');

  // voice
  let voice = cfg.voice, voiceSrc = src('voice');
  if (voice === 'auto') { voice = files.audio.length ? 'audio' : 'none'; voiceSrc = 'auto'; }
  cfg.voiceMode = voice;
  note('voice', voice, voiceSrc, voice === 'audio' ? `${files.audio.length} file(s) in audio/` : voice === 'none' ? 'no audio/ folder: timing will be estimated and the video has no voice' : '');

  // captions
  let captionsSrc = src('captions');
  if (cfg.captions === 'none' && voice === 'none') { cfg.captions = 'word'; captionsSrc = 'auto'; note('captions', 'word', 'auto', 'no voice and no captions would leave the dialogue invisible'); }
  else note('captions', cfg.captions, captionsSrc);

  // characters
  if (user.characters?.describe === undefined) { cfg.characters.describe = files.characters.length > 0; }
  note('characters', cfg.characters.describe ? `described (${files.characters.length} file(s) in characters/)` : 'generated from the dialogue', user.characters?.describe === undefined ? 'auto' : 'project.json');

  // format
  if (!FORMATS[cfg.format]) throw new Error(`Unknown format ${cfg.format}. Use one of ${Object.keys(FORMATS).join(', ')}`);
  const [bw, bh] = FORMATS[cfg.format];
  const w = cfg.width || bw;
  cfg.video = { width: even(w), height: even(Math.round((w * bh) / bw)), fps: cfg.fps };
  note('format', `${cfg.format} ${cfg.video.width}x${cfg.video.height} @ ${cfg.fps} fps`, src('format'));
  note('style', cfg.style, src('style'));
  note('seed', cfg.seed, src('seed'));

  cfg.title = cfg.title || (files.dialogue ? null : path.basename(files.dir));
  cfg.output = cfg.output ? path.resolve(files.dir, cfg.output) : null; // filled after parse (needs the title)
  return { cfg, decisions, files };
}

const even = (n) => Math.round(n / 2) * 2;

export function outputPath(cfg, files, title) {
  return cfg.output || path.join(files.out, `${slug(title || path.basename(files.dir))}.mp4`);
}

export function writeDecisions(files, decisions, extra = []) {
  const rows = [...decisions, ...extra];
  const md = [
    '# Decisions',
    '',
    'Every setting the pipeline used and where it came from (cli / project.json / auto / default).',
    'A non-interactive agent should paste this table into its final report.',
    '',
    '| setting | value | source | why |',
    '|---|---|---|---|',
    ...rows.map((d) => `| ${d.key} | ${String(d.value).replace(/\|/g, '/')} | ${d.source} | ${d.why || ''} |`),
    '',
  ].join('\n');
  ensureDir(files.build);
  return writeText(path.join(files.build, 'decisions.md'), md);
}
