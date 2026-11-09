// `da next <dir>`: looks at the project folder and says the ONE thing to do next.
// This is what makes the skill independent of the model: the decisions live here, in deterministic code.
// An agent only has to run this, do what it prints, and repeat until it prints DONE.
// States: run (execute `command`) · ask (ask the user, then run `answerCommand`, or `defaultsCommand` if you cannot ask)
//         edit (a file must be written, see `instructions`) · fix (QA failed) · blocked (needs the user) · done
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, exists, readJSON, c } from './lib/util.mjs';
import { runChecks } from './doctor.mjs';
import { scanProject, outputPath, loadConfig } from './project/config.mjs';
import { listStyles, resolveStyleDir } from './style/load.mjs';
import { resolveSfx } from './audio/sfx.mjs';
import { foldKey } from './lib/text.mjs';

const slash = (p) => p.split(path.sep).join('/');
const DA = `node "${slash(ROOT)}/bin/da.mjs"`;
const q = (p) => `"${slash(path.resolve(p))}"`;
const mtime = (p) => { try { return fs.statSync(p).mtimeMs; } catch { return 0; } };
const stale = (artifact, sources) => { const a = mtime(artifact); return !a || sources.filter(Boolean).some((s) => mtime(s) > a); };

export const FORMAT_HELP = [
  'Name: what they say                 one utterance per line',
  'Anlatıcı: text   (or Narrator: text)  off-screen narration, heard but not seen',
  'Ali (dış ses): text                 this character is heard, not seen speaking',
  '## Kitchen                          starts a new scene; its words choose the set',
  '@cast Ali, Su                       who is on stage without having to speak',
  '@sfx thunder                        a sound effect: a file in sfx/ or a built-in (door, bolt, clink, knock, whoosh)',
  '0–5 sn — a stage direction          optional: a timed beat; the lines under it go into that window',
];

const STEPS = ['tools', 'dialogue', 'parse', 'answers', 'cast', 'align', 'board', 'render', 'mix', 'qa'];

function questions(files, dialogue) {
  const styles = listStyles([path.join(files.dir, 'styles')]).map((s) => s.id);
  const list = [
    ...(!files.audio.length && !files.otherAudioDirs.length && !files.music.length && !files.sfx.length
      ? [{ id: 'own-files', question: 'Do you have your own voice recordings, sound effects or music to add?', options: ['no', 'yes'], default: 'no', flag: null }]
      : []),
    { id: 'style', question: 'Which visual style?', options: styles, default: 'kesik-kagit', flag: '--style' },
    { id: 'format', question: 'Which format?', options: ['9:16', '16:9', '1:1', '4:5'], default: '9:16', flag: '--format' },
    { id: 'captions', question: 'Captions?', options: ['word', 'line', 'bubble', 'none'], default: 'word', flag: '--captions' },
  ];
  if (!files.music.length) list.push({ id: 'music', question: 'Generated music, or none?', options: ['synth', 'none'], default: 'synth', flag: '--music' });
  if (!files.audio.length && !files.otherAudioDirs.length) list.push({ id: 'voice', question: 'There is no voice recording. Silent with captions, or a playful gibberish voice?', options: ['none', 'babble'], default: 'none', flag: '--voice' });
  const has = (s) => files.characters.some((f) => [foldKey(s.id), foldKey(s.name)].includes(foldKey(path.basename(f, path.extname(f)))));
  const missing = dialogue.speakers.filter((s) => !s.narrator && !has(s));
  const note = missing.length ? `Optional: if the user wants to describe a character (looks, colours, personality, accessories), write characters/<id>.md or .json first. Ids: ${missing.map((s) => s.id).join(', ')}. Otherwise they are generated.` : null;
  return { list, note };
}

export async function decide(dirArg) {
  const dir = path.resolve(dirArg);
  const again = `${DA} next ${q(dir)}`;
  const n = (step) => ({ step, stepNumber: STEPS.indexOf(step) + 1, totalSteps: STEPS.length, then: again });
  const run = (step, command, why, extra = {}) => ({ state: 'run', ...n(step), command, why, ...extra });
  const da = (cmd) => `${DA} ${cmd} ${q(dir)}`;

  // tools
  const bad = runChecks(dir).checks.filter((x) => x.status === 'fail');
  if (bad.some((x) => x.name === '@napi-rs/canvas')) return run('tools', `npm install --prefix ${q(ROOT)}`, 'the skill\'s one dependency is not installed yet');
  if (bad.length) return { state: 'blocked', ...n('tools'), why: bad.map((x) => `${x.name}: ${x.detail}`).join('; '), instructions: bad.map((x) => x.fix).filter(Boolean) };

  // dialogue file
  const files = scanProject(dir);
  if (!files.dialogue) {
    const other = exists(dir) ? fs.readdirSync(dir).filter((f) => /\.(md|txt)$/i.test(f) && !/^readme/i.test(f)) : [];
    return {
      state: 'edit', ...n('dialogue'), why: `no dialogue.md in ${slash(dir)}`,
      instructions: [
        ...(other.length ? [`This folder has ${other.join(', ')}. If that is the script, copy it to dialogue.md.`] : []),
        `Create the folder if needed and write the user's script to ${slash(path.join(dir, 'dialogue.md'))}, using their exact words. Never invent a script: if they have not given one, ask for it.`,
        'Format:', ...FORMAT_HELP.map((l) => `  ${l}`),
      ],
    };
  }

  // parse
  const b = (f) => path.join(files.build, f);
  if (stale(b('dialogue.json'), [files.dialogue])) return run('parse', da('parse'), 'the script has not been read yet, or it changed');
  const dialogue = readJSON(b('dialogue.json'));

  // answers
  if (!files.projectJson) {
    const { list, note } = questions(files, dialogue);
    const flags = list.filter((x) => x.flag).map((x) => `${x.flag} <${x.id}>`).join(' ');
    return {
      state: 'ask', ...n('answers'), why: 'no project.json yet', questions: list,
      instructions: [
        'Ask the user these questions in one short message, in their language, showing each default.',
        ...(list.some((x) => x.id === 'own-files') ? [`If they have files to add, or ask for the folders to be prepared: run ${da('init')}. It makes audio/, sfx/, music/ and characters/ and leaves the script alone. Tell them what goes where, wait until they say the files are in, then run the AFTER THAT command instead of THEN RUN.`] : []),
        ...(note ? [note] : []),
        ...(files.otherAudioDirs.length ? [`Audio was found in ${files.otherAudioDirs.join(', ')}. If that is the voice, add: --audio-dir ${files.otherAudioDirs[0]}`] : []),
      ],
      answerCommand: `${da('answer')} ${flags}`,
      defaultsCommand: `${da('answer')} --defaults`,
    };
  }

  const { cfg } = loadConfig(dir);
  const pj = files.projectJson;
  const lost = (dialogue.sfx || []).filter((s) => !resolveSfx(s.name, files.sfx));
  if (lost.length) return { state: 'edit', ...n('board'), why: `sound effect not found: ${lost.map((s) => s.name).join(', ')}`, instructions: [`Put a file with that name in ${slash(path.join(dir, files.sfxDir))}/ (for example ${lost[0].name}.wav), or remove the @sfx line from dialogue.md. Built-in names: door, bolt, clink, knock, whoosh.`] };

  // pipeline, each step only when its output is missing or older than what it depends on
  if (stale(b('characters.json'), [b('dialogue.json'), pj, ...files.characters])) return run('cast', da('cast'), 'the characters have not been built yet, or their sources changed');
  if (stale(b('timing.json'), [b('dialogue.json'), pj, files.words, ...files.audio])) return run('align', da('align'), 'the voice has not been timed yet, or it changed');
  let styleJson = null;
  try { styleJson = path.join(resolveStyleDir(cfg.style, files.dir), 'style.json'); } catch (e) { return { state: 'edit', ...n('board'), why: e.message, instructions: ['Set an existing style in project.json ("style").'] }; }
  if (stale(b('storyboard.json'), [b('dialogue.json'), b('characters.json'), b('timing.json'), pj, styleJson])) return run('board', da('board'), 'the scenes have not been directed yet, or an input changed');
  if (stale(b('video.mp4'), [b('storyboard.json')])) return run('render', da('render'), 'the picture has not been rendered yet, or the storyboard changed', { hints: ['Optional, if you can see images: run `stills` first and look at build/stills/sheet.png.'] });
  const sb = readJSON(b('storyboard.json'));
  const out = outputPath(cfg, files, sb.meta.title);
  if (stale(out, [b('video.mp4'), b('voice.wav'), pj, ...files.music, ...files.sfx])) return run('mix', da('mix'), 'the sound has not been mixed yet, or an input changed');
  if (stale(b('qa/report.json'), [out])) return run('qa', da('qa'), 'the finished video has not been checked yet');

  const report = readJSON(b('qa/report.json'));
  const fails = report.checks.filter((x) => x.status === 'fail');
  if (fails.length) {
    return {
      state: 'fix', ...n('qa'), why: fails.map((x) => `${x.name}: ${x.detail}`).join('; '),
      instructions: [`Read ${slash(b('qa/report.md'))} and docs/TROUBLESHOOTING.md in the skill folder.`, 'Fix the cause (dialogue.md, project.json, characters/ or the audio), then run the "then" command. If you cannot fix it, tell the user exactly what failed.'],
    };
  }
  const notes = report.checks.filter((x) => x.status === 'warn').map((x) => `${x.name}: ${x.detail}`);
  const timing = readJSON(b('timing.json'));
  return {
    state: 'done', step: 'done', stepNumber: STEPS.length, totalSteps: STEPS.length, then: null, video: slash(out), verdict: report.verdict,
    decisions: slash(b('decisions.md')), estimatedTiming: !!timing.estimated, warnings: notes,
    instructions: [
      `Give the user ${slash(out)}.`,
      `Tell them the QA verdict (${report.verdict}) and what was assumed: paste the table from ${slash(b('decisions.md'))}.`,
      ...(timing.estimated ? ['Say clearly that the timing is ESTIMATED because there was no usable voice recording.'] : []),
    ],
  };
}

function print(d) {
  const head = d.state === 'done' ? c.green('DONE') : c.bold(`STEP ${d.stepNumber}/${d.totalSteps}: ${d.step}`);
  console.log(head);
  if (d.why) console.log(`WHY:  ${d.why}`);
  if (d.state === 'run') console.log(`RUN:  ${d.command}`);
  if (d.questions) d.questions.forEach((x, i) => console.log(`Q${i + 1}:   ${x.question} [${x.options.join(' | ')}] default: ${x.default}`));
  for (const l of d.instructions || []) console.log(`DO:   ${l}`);
  if (d.answerCommand) console.log(`THEN RUN:        ${d.answerCommand}`);
  if (d.defaultsCommand) console.log(`CANNOT ASK? RUN: ${d.defaultsCommand}`);
  for (const l of d.hints || []) console.log(`HINT: ${l}`);
  for (const l of d.warnings || []) console.log(`WARN: ${l}`);
  if (d.video) console.log(`VIDEO: ${d.video}`);
  if (d.then) console.log(`AFTER THAT, RUN AGAIN: ${d.then}`);
}

export async function cli(args) {
  const d = await decide(args._[0] || '.');
  if (args.json) console.log(JSON.stringify(d, null, 1)); else print(d);
  return d.state === 'blocked' ? 2 : 0;
}
