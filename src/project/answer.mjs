// `da answer <dir> --style jole --captions line ...`: store the answers in project.json, so no agent has
// to write JSON by hand. `--defaults` accepts everything. Existing answers are kept unless overridden.
import path from 'node:path';
import { log, rel, readJSON, writeJSON } from '../lib/util.mjs';
import { validate, loadSchema } from '../lib/schema.mjs';
import { scanProject, DEFAULTS } from './config.mjs';
import { resolveStyleDir } from '../style/load.mjs';

export async function cli(args) {
  const dir = path.resolve(args._[0] || '.');
  const files = scanProject(dir);
  const out = files.projectJson ? readJSON(files.projectJson) : {};
  for (const k of ['style', 'format', 'captions', 'voice', 'audioDir', 'musicDir', 'sfxDir', 'title']) if (typeof args[k] === 'string') out[k] = args[k];
  if (typeof args.music === 'string') out.music = args.music;
  if (args.mood || args.tempo) {
    const m = typeof out.music === 'object' ? out.music : { mode: out.music || 'synth' };
    if (args.mood) m.mood = args.mood;
    if (args.tempo) m.tempo = +args.tempo;
    out.music = m;
  }
  if (args.defaults) {
    for (const k of ['style', 'format', 'captions']) out[k] ??= DEFAULTS[k];
    if (!files.audio.length && files.otherAudioDirs.length === 1) out.audioDir ??= files.otherAudioDirs[0];
  }
  const { valid, errors } = validate(out, loadSchema('project'));
  if (!valid) throw new Error(`These answers are not valid:\n${errors.map((e) => '  - ' + e).join('\n')}`);
  if (out.style) resolveStyleDir(out.style, dir);
  const file = path.join(dir, 'project.json');
  writeJSON(file, out);
  log.ok(`${rel(file)}: ${JSON.stringify(out)}`);
  return 0;
}
