#!/usr/bin/env node
// dialogue-animator CLI. Every pipeline step is a sub-command; `make` runs them all in order.
// Commands are imported lazily so `doctor` still works when dependencies are missing.
import { parseArgs, log, c, VERSION } from '../src/lib/util.mjs';

const HELP = `dialogue-animator ${VERSION}

Usage: da <command> [project-folder] [options]

Pipeline (in order; "make" runs all of them):
  doctor   [dir]          Check tools, fonts and (optionally) a project folder
  init     <dir>          Create a starter project folder
  parse    <dir>          dialogue.md/.txt/.json -> build/dialogue.json
  cast     <dir>          characters/ or the dialogue -> build/characters.json
  babble   <dir>          Synthesize a gibberish voice per line (no recording needed)
  align    <dir>          Voice timing -> build/timing.json, build/voice.wav
  board    <dir>          Direct the scenes -> build/storyboard.json (+ rhythm lint)
  stills   <dir>          Render still frames: --t 1.5,4 | --shots | --frames 30,90
  render   <dir>          Render the picture -> build/video.mp4  (--scale 0.5 for drafts)
  music    <dir>          Synthesize an original music bed -> build/music.wav
  mix      <dir>          Duck music under the voice, normalize to -14 LUFS, mux -> out/*.mp4
  qa       <dir>          Frame/audio/layout checks, contact sheets -> build/qa/report.md
  make     <dir>          All of the above, non-interactive

Tools:
  styles                  List style packs
  style new <id> --from <pack>   Copy a pack to styles/<id> (or <dir>/styles/<id> with --project)
  style check <id|path>   Validate a pack against the schema and the style-guide limits
  style preview <id|path> Render the standard test scene in that style
  style palette <image>   Print the dominant colours of an image as hex
  sheet    <video>        Contact sheet of any video
  compare  --a a.png,b.png --b c.png,d.png --out x.png   Side-by-side review sheet
  preview  <dir>          Live preview page in a browser (no build step)
  clean    <dir>          Delete build/tmp (and with --all the whole build/ folder)

Common options:
  --style <id>  --captions none|word|line|bubble  --format 9:16|16:9|1:1|4:5
  --music synth|own|none  --voice auto|babble|none  --seed <n>  --workers <n>
  --scale <0.25..1>  --renderer node|playwright  --yes (never prompt)
`;

const commands = {
  doctor: () => import('../src/doctor.mjs'),
  init: () => import('../src/project/init.mjs'),
  parse: () => import('../src/project/parse.mjs'),
  cast: () => import('../src/project/cast.mjs'),
  babble: () => import('../src/audio/babble.mjs'),
  align: () => import('../src/audio/align.mjs'),
  board: () => import('../src/director/storyboard.mjs'),
  stills: () => import('../src/render/stills.mjs'),
  render: () => import('../src/render/render.mjs'),
  music: () => import('../src/audio/music.mjs'),
  mix: () => import('../src/audio/mix.mjs'),
  qa: () => import('../src/qa/qa.mjs'),
  make: () => import('../src/make.mjs'),
  styles: () => import('../src/style/cli.mjs'),
  style: () => import('../src/style/cli.mjs'),
  sheet: () => import('../src/qa/sheet.mjs'),
  compare: () => import('../src/qa/compare.mjs'),
  preview: () => import('../src/preview/server.mjs'),
  clean: () => import('../src/clean.mjs'),
};

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') { console.log(HELP); process.exit(0); }
if (cmd === '--version' || cmd === '-v') { console.log(VERSION); process.exit(0); }
if (!commands[cmd]) { console.error(`Unknown command "${cmd}".\n`); console.log(HELP); process.exit(2); }

const args = parseArgs(argv.slice(1));
args.command = cmd;
try {
  const mod = await commands[cmd]();
  const code = await mod.cli(args);
  process.exit(typeof code === 'number' ? code : 0);
} catch (e) {
  log.err(e.message);
  if (process.env.DA_DEBUG) console.error(e.stack);
  else console.error(c.dim('  (set DA_DEBUG=1 for the stack trace)'));
  process.exit(1);
}
