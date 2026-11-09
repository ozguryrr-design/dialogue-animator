// `da doctor [dir]`: checks everything the pipeline needs and says exactly how to fix what is missing.
// Exit code 0 = ready, 1 = something required is missing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ROOT, c, exists, humanBytes, rel, VERSION } from './lib/util.mjs';
import { findFfmpeg, ffmpegCapabilities } from './lib/ffmpeg.mjs';
import { missingGlyphs, TURKISH_TEST } from './lib/fontcheck.mjs';

const req = createRequire(path.join(ROOT, 'package.json'));

const FFMPEG_FIX = {
  win32: 'winget install Gyan.FFmpeg   (or: choco install ffmpeg / scoop install ffmpeg / pip install imageio-ffmpeg), or set FFMPEG_PATH to ffmpeg.exe',
  darwin: 'brew install ffmpeg   (or set FFMPEG_PATH)',
  linux: 'sudo apt install ffmpeg   (Fedora: sudo dnf install ffmpeg; Arch: sudo pacman -S ffmpeg), or set FFMPEG_PATH',
};

export function runChecks(dir) {
  const checks = [];
  const add = (group, name, status, detail, fix) => checks.push({ group, name, status, detail, fix });

  // --- runtime ---
  const major = +process.versions.node.split('.')[0];
  add('runtime', 'Node.js', major >= 20 ? 'ok' : 'fail', `v${process.versions.node}`, 'Install Node.js 20 or newer from https://nodejs.org');
  try {
    const pkg = JSON.parse(fs.readFileSync(req.resolve('@napi-rs/canvas/package.json'), 'utf8'));
    req('@napi-rs/canvas');
    add('runtime', '@napi-rs/canvas', 'ok', `v${pkg.version} (Canvas2D without a browser)`);
  } catch (e) {
    add('runtime', '@napi-rs/canvas', 'fail', 'not installed or cannot load', `Run "npm install" inside ${ROOT}`);
  }

  // --- ffmpeg ---
  const ff = findFfmpeg({ refresh: true });
  if (!ff.ffmpeg) {
    add('media', 'ffmpeg', 'fail', `not found (tried: ${ff.tried.join(', ')})`, FFMPEG_FIX[process.platform] || FFMPEG_FIX.linux);
  } else {
    const caps = ffmpegCapabilities();
    add('media', 'ffmpeg', 'ok', `${caps.version} via ${ff.source}`);
    const needF = Object.entries(caps.filters).filter(([, v]) => !v).map(([k]) => k);
    const needE = Object.entries(caps.encoders).filter(([, v]) => !v).map(([k]) => k);
    add('media', 'ffmpeg filters', needF.length ? 'fail' : 'ok', needF.length ? `missing: ${needF.join(', ')}` : 'loudnorm, sidechaincompress, ebur128, amix', 'Install a full ffmpeg build (the "essentials" or "full" build on Windows).');
    add('media', 'ffmpeg encoders', needE.length ? 'fail' : 'ok', needE.length ? `missing: ${needE.join(', ')}` : 'libx264 + aac', 'Install an ffmpeg build with libx264 (most distro and Homebrew builds have it).');
    add('media', 'ffprobe', ff.ffprobe ? 'ok' : 'info', ff.ffprobe ? 'found' : 'not found — not needed (durations come from decoded audio)');
  }

  // --- fonts ---
  let styles = [];
  try {
    const dirs = fs.readdirSync(path.join(ROOT, 'styles'));
    for (const d of dirs) {
      const f = path.join(ROOT, 'styles', d, 'style.json');
      if (!exists(f)) continue;
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      const files = (s.fonts || []).map((x) => path.resolve(path.dirname(f), x.file));
      const missingFiles = files.filter((p) => !exists(p));
      if (missingFiles.length) { add('fonts', `style ${s.id}`, 'fail', `font file missing: ${missingFiles.map((p) => rel(p, ROOT)).join(', ')}`, 'Restore the fonts/ folder from the repository.'); continue; }
      const miss = missingGlyphs(TURKISH_TEST, files);
      add('fonts', `style ${s.id}`, miss.length ? 'fail' : 'ok', miss.length ? `cannot draw: ${miss.join(' ')}` : `Turkish test ${TURKISH_TEST} covered`, 'Add a font that covers these characters to the pack (see docs/STYLE_PACK.md).');
      styles.push({ id: s.id, files });
    }
  } catch (e) { add('fonts', 'style packs', 'fail', e.message); }

  // --- optional tools ---
  const py = ['python', 'python3', 'py'].find((p) => spawnSync(p, ['--version'], { windowsHide: true }).status === 0);
  let whisper = null;
  if (py) {
    if (spawnSync(py, ['-c', 'import faster_whisper'], { windowsHide: true }).status === 0) whisper = `faster-whisper (${py})`;
  }
  if (!whisper && spawnSync('whisper', ['--help'], { windowsHide: true }).status === 0) whisper = 'openai-whisper CLI';
  add('optional', 'whisper (word timings)', whisper ? 'ok' : 'info', whisper || 'not installed — only needed for a single voice file without words.json',
    'pip install faster-whisper   (the first run downloads a model, ~150 MB for "base")');
  let pw = null;
  for (const m of ['playwright', 'playwright-core']) { try { req.resolve(m); pw = m; break; } catch { /* not installed */ } }
  add('optional', 'Playwright renderer', pw ? 'ok' : 'info', pw ? `${pw} installed (--renderer playwright)` : 'not installed — the default Node renderer needs no browser', 'npm install playwright-core   (uses an installed Chrome/Edge)');

  // --- disk ---
  try {
    const target = dir && exists(dir) ? dir : process.cwd();
    const st = fs.statfsSync(target);
    const free = st.bavail * st.bsize;
    add('disk', 'free space', free > 2e9 ? 'ok' : 'warn', `${humanBytes(free)} free on the project drive (a 30 s video needs ~0.3 GB while rendering)`, 'Free some space or render to another drive.');
  } catch { /* statfs not available */ }

  return { checks, styles };
}

export async function projectChecks(dir, checks, styles) {
  const add = (name, status, detail, fix) => checks.push({ group: 'project', name, status, detail, fix });
  const { scanProject, loadConfig } = await import('./project/config.mjs');
  const files = scanProject(dir);
  if (!files.dialogue) {
    add('dialogue file', 'fail', `no dialogue.md / dialogue.txt / dialogue.json in ${files.dir}`, PROJECT_LAYOUT);
    return;
  }
  add('dialogue file', 'ok', rel(files.dialogue, files.dir));
  let cfg;
  try { ({ cfg } = loadConfig(dir)); add('project.json', files.projectJson ? 'ok' : 'info', files.projectJson ? 'valid' : 'not present — defaults will be used'); }
  catch (e) { add('project.json', 'fail', e.message, 'Fix the fields listed above (schema: schemas/project.schema.json).'); return; }
  let dialogue;
  try {
    const { parseDialogueFile } = await import('./project/parse.mjs');
    dialogue = parseDialogueFile(files.dialogue);
    const speakers = dialogue.speakers.map((s) => s.name).join(', ');
    add('dialogue', dialogue.lines.length ? 'ok' : 'fail', `${dialogue.lines.length} lines, speakers: ${speakers || '—'}, language: ${dialogue.language}`, 'Write one line per utterance as "Name: text".');
    for (const w of dialogue.warnings) add('dialogue', 'warn', w);
  } catch (e) { add('dialogue', 'fail', e.message, 'See docs/PROJECT_FOLDER.md for the dialogue format.'); return; }

  const n = dialogue.lines.length, a = files.audio.length;
  if (!a && files.otherAudioDirs.length) add('audio folder', 'warn', `no audio in ${files.audioDir}/, but ${files.otherAudioDirs.map((d) => d + '/').join(', ')} contains audio`, `Move the files to ${files.audioDir}/ or add "audioDir": "${files.otherAudioDirs[0]}" to project.json.`);
  if (dialogue.beats?.length) add('timed beats', 'ok', `${dialogue.beats.length} beats (${dialogue.beats[0].start}–${dialogue.beats.at(-1).end ?? '…'} s): lines are placed in their time windows`);
  if (files.words) add('timing source', 'ok', `words.json (${rel(files.words, files.dir)}) — exact word timings`);
  else if (a === 0) add('timing source', cfg.voice === 'babble' ? 'ok' : 'warn', cfg.voice === 'babble' ? 'babble voice will be synthesized per line' : `no audio in ${files.audioDir}/: timing will be ESTIMATED from text length and the video is silent`, 'Best: one file per line in audio/ (01_name.wav, 02_name.wav ...).');
  else if (a === n) add('timing source', 'ok', `${a} files for ${n} lines — per-line audio (most reliable)`);
  else if (a === 1) add('timing source', 'ok', `one voice file — lines found by ${checks.find((x) => x.name.startsWith('whisper'))?.status === 'ok' ? 'whisper' : 'silence detection (install faster-whisper for better results)'}`);
  else add('timing source', 'warn', `${a} audio files for ${n} lines — files are matched by their number prefix; lines without a file get estimated timing`, 'Name files 01_name.wav, 02_name.wav ... one per line.');

  add('characters', 'ok', files.characters.length ? `${files.characters.length} file(s) in characters/` : 'none — characters will be generated from the dialogue');
  add('music', files.music.length > 1 ? 'warn' : 'ok', cfg.music.mode === 'own' ? `own: ${path.basename(cfg.music.file)}` : cfg.music.mode, 'Only the first file in the music folder is used; set "music": {"mode": "own", "file": "music/x.mp3"} to pick another.');
  const vo = dialogue.lines.filter((l) => l.voiceOver);
  if (vo.length) add('narration', 'ok', `${vo.length} line(s) heard but not seen: ${[...new Set(vo.map((l) => l.speakerName))].join(', ')}`);
  const { resolveSfx } = await import('./audio/sfx.mjs');
  if (files.sfx.length || dialogue.sfx?.length) {
    const lost = (dialogue.sfx || []).filter((s) => !resolveSfx(s.name, files.sfx));
    add('sound effects', lost.length ? 'fail' : 'ok', lost.length ? `not found: ${lost.map((s) => s.name).join(', ')}` : `${files.sfx.length} file(s) in ${files.sfxDir}/, ${(dialogue.sfx || []).length} cue(s) in the script`, `Put a file with that name in ${files.sfxDir}/ (e.g. ${files.sfxDir}/${lost[0]?.name || 'name'}.wav) or remove the @sfx line. Built-in names: door, bolt, clink, knock, whoosh.`);
  }

  const style = styles.find((s) => s.id === cfg.style);
  if (style) {
    const miss = missingGlyphs(dialogue.lines.map((l) => l.text + ' ' + (l.speakerName || '')).join(' '), style.files);
    add('font coverage', miss.length ? 'fail' : 'ok', miss.length ? `style ${cfg.style} cannot draw: ${miss.slice(0, 20).join(' ')}` : `every character of the dialogue is covered by ${cfg.style}`,
      'Add a font with these characters to the style pack (e.g. a Noto Sans CJK / Arabic font) and list it in "fonts".');
  } else if (cfg.style) add('style', 'info', `custom style "${cfg.style}" (checked when it is loaded)`);
  try {
    fs.mkdirSync(files.build, { recursive: true });
    fs.accessSync(files.build, fs.constants.W_OK);
    add('build folder', 'ok', `${rel(files.build, files.dir)}/ is writable`);
  } catch { add('build folder', 'fail', `cannot write ${files.build}`, 'Check folder permissions.'); }
}

export const PROJECT_LAYOUT = `Prepare a folder like this (only dialogue.md is required):
      my-video/
        dialogue.md      Ali: Hello!   (one line per utterance, "Name: text")
        audio/           optional: 01_ali.wav, 02_su.wav ... (one file per line) or a single file
        characters/      optional: ali.md (a short description) or ali.png
        music/           optional: one music file
        project.json     optional: answers (style, captions, format, music ...)
      Or run: da init my-video`;

export function printChecks(checks) {
  const icon = { ok: c.green('✔'), fail: c.red('✖'), warn: c.yellow('!'), info: c.blue('•') };
  let group = null;
  for (const ch of checks) {
    if (ch.group !== group) { group = ch.group; console.log(c.bold(`\n${group}`)); }
    console.log(`  ${icon[ch.status]} ${ch.name.padEnd(24)} ${ch.detail || ''}`);
    if ((ch.status === 'fail' || ch.status === 'warn') && ch.fix) console.log(c.dim(`      fix: ${ch.fix.replace(/\n/g, '\n      ')}`));
  }
}

export async function cli(args) {
  const dir = args._[0] || process.cwd();
  console.log(c.bold(`dialogue-animator ${VERSION} — doctor`) + c.dim(`  (${os.platform()} ${os.arch()})`));
  const { checks, styles } = runChecks(dir);
  await projectChecks(dir, checks, styles);
  printChecks(checks);
  const fails = checks.filter((x) => x.status === 'fail');
  const warns = checks.filter((x) => x.status === 'warn');
  console.log('');
  if (fails.length) { console.log(c.red(`${fails.length} required item(s) missing. Fix them and run "da doctor" again.`)); return 1; }
  console.log(c.green(`Ready.`) + (warns.length ? c.yellow(` ${warns.length} warning(s) above.`) : ''));
  return 0;
}
