// The promise of this skill: an agent with no judgment at all can finish the job.
// The "agent" below only runs `da next --json` and executes exactly what it says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, readJSON } from '../src/lib/util.mjs';
import { findFfmpeg } from '../src/lib/ffmpeg.mjs';
import { writeWav } from '../src/lib/wav.mjs';

const da = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'da.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const shell = (cmd) => spawnSync(cmd, { shell: true, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
const tone = (sec, hz, amp = 0.4) => Float32Array.from({ length: Math.round(sec * 48000) }, (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / 48000) * Math.min(1, i / 2000, (sec * 48000 - i) / 2000));
const next = (dir) => JSON.parse(da('next', dir, '--json').stdout);

/** The agent: runs what `da next` says, takes the defaults when asked or told to design, and has no other ideas. */
function obey(dir) {
  const seen = [];
  let d;
  for (let i = 0; i < 25; i++) {
    d = next(dir);
    seen.push(d.step);
    if (d.state === 'done') break;
    assert.ok(['run', 'ask', 'design'].includes(d.state), `the agent got stuck: ${JSON.stringify(d)}`);
    const r = shell(d.state === 'run' ? d.command : d.defaultsCommand);
    assert.equal(r.status, 0, `${d.command || d.defaultsCommand}\n${r.stdout}\n${r.stderr}`);
  }
  assert.equal(d.state, 'done', `never finished: ${seen.join(' > ')}`);
  return { d, seen };
}

test('a literal agent loop finishes a folder with narration, dialogue, own voice, own sfx and own music', { skip: !findFfmpeg().ffmpeg && 'ffmpeg not available', timeout: 300000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  for (const d of ['audio', 'sfx', 'music']) fs.mkdirSync(path.join(dir, d));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), '# Tam Set\n## Park\nAnlatıcı: O sabah parkta kimse yoktu.\n@sfx gong\nAli: Merhaba!\nSu: Selam, nasılsın?\n');
  writeWav(path.join(dir, 'audio', '01_anlatici.wav'), tone(2, 180));
  writeWav(path.join(dir, 'audio', '02_ali.wav'), tone(1, 220));
  writeWav(path.join(dir, 'audio', '03_su.wav'), tone(1.2, 260));
  writeWav(path.join(dir, 'sfx', 'gong.wav'), tone(0.6, 700));
  writeWav(path.join(dir, 'music', 'benim-muzigim.wav'), tone(3, 110, 0.2));

  const { d, seen } = obey(dir);
  assert.deepEqual(seen, ['parse', 'answers', 'design', 'design', 'cast', 'align', 'board', 'render', 'mix', 'qa', 'done']);
  assert.ok(fs.existsSync(d.video));
  assert.notEqual(d.verdict, 'FAIL');
  assert.equal(d.estimatedTiming, false);

  const sb = readJSON(path.join(dir, 'build', 'storyboard.json'));
  assert.deepEqual(sb.characters.map((c) => c.id), ['ali', 'su'], 'the narrator is not a character');
  assert.ok(sb.lines[0].voiceOver);
  assert.ok(sb.events.some((e) => e.type === 'sfx' && e.value === 'gong'));
  assert.ok(fs.existsSync(path.join(dir, 'build', 'sfx.wav')), 'the user sound effect was mixed in');
  assert.match(fs.readFileSync(path.join(dir, 'build', 'decisions.md'), 'utf8'), /music \| own \(benim-muzigim\.wav\)/);
  assert.equal(next(dir).state, 'done', 'a finished project stays finished');

  // changing the script makes the loop go back to the right step
  const f = path.join(dir, 'dialogue.md');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8') + '\n');
  const t = new Date(Date.now() + 2000);
  fs.utimesSync(f, t, t);
  assert.equal(next(dir).step, 'parse');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('only a script, every default: a finished video, with the timing flagged as estimated', { skip: !findFfmpeg().ffmpeg && 'ffmpeg not available', timeout: 300000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), 'Ali: Çay bitti mi?\nSu: Bitti.\nAli: Eyvah!\n');
  const { d } = obey(dir);
  assert.ok(fs.existsSync(d.video));
  assert.notEqual(d.verdict, 'FAIL');
  assert.equal(d.estimatedTiming, true);
  assert.match(d.instructions.join('\n'), /ESTIMATED/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('no voice and no music: the silent video is not failed for its loudness', { skip: !findFfmpeg().ffmpeg && 'ffmpeg not available', timeout: 300000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), 'Ali: Çay bitti mi?\nSu: Bitti.\n');
  assert.equal(da('answer', dir, '--music', 'none', '--voice', 'none').status, 0);
  const { d } = obey(dir);
  assert.notEqual(d.verdict, 'FAIL');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('only a script: next asks what is missing and offers to prepare the folders', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  const script = 'Ali: Selam!\nSu: Selam.\n';
  const file = path.join(dir, 'dialogue.md');
  fs.writeFileSync(file, script);
  assert.equal(shell(next(dir).command).status, 0); // parse
  const d = next(dir);
  assert.equal(d.state, 'ask');
  assert.deepEqual(d.questions.map((q) => q.id), ['own-files', 'style', 'format', 'captions', 'music', 'voice']);
  for (const q of d.questions) assert.ok(q.options.includes(q.default), `${q.id} needs a default`);
  assert.doesNotMatch(d.answerCommand, /own-files/);
  assert.match(d.instructions.join('\n'), /da\.mjs" init /);

  // the user says yes: the folders appear, the script stays, and the loop waits
  assert.equal(da('init', dir).status, 0);
  assert.equal(fs.readFileSync(file, 'utf8'), script, 'init never touches the script');
  for (const f of ['audio', 'sfx', 'music', 'characters', 'README.txt']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.equal(next(dir).state, 'ask');

  // once a file is in, nobody is asked about it again
  writeWav(path.join(dir, 'music', 'parca.wav'), tone(1, 200));
  const ids = next(dir).questions.map((q) => q.id);
  assert.ok(!ids.includes('own-files') && !ids.includes('music'), ids.join());
  fs.rmSync(dir, { recursive: true, force: true });
});

test('init never writes a script unless the sample is asked for', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  assert.equal(da('init', dir).status, 0);
  assert.equal(da('init', dir).status, 0, 'running it twice is harmless');
  assert.ok(!fs.existsSync(path.join(dir, 'dialogue.md')));
  assert.equal(next(dir).state, 'edit', 'the script still has to come from the user');
  assert.equal(da('init', dir, '--sample').status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'dialogue.md')));
  assert.equal(da('init', dir, '--sample').status, 1, 'the sample never replaces a script');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a script with no speaker names says how to fix it and not to guess', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), '- Merhaba.\n- Selam.\n');
  const r = da('parse', dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout + r.stderr, /Ali: Merhaba/);
  assert.match(r.stdout + r.stderr, /ask the user/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('next: an empty folder asks for the script and never invents one', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  const d = next(dir);
  assert.equal(d.state, 'edit');
  const text = d.instructions.join('\n');
  assert.match(text, /dialogue\.md/);
  assert.match(text, /Never invent/);
  assert.match(text, /Anlatıcı/);
  assert.match(text, /@sfx/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('next: a sound effect that does not exist is reported before any rendering', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), 'Ali: Selam!\n@sfx yok-boyle-ses\nSu: Selam.\n');
  fs.writeFileSync(path.join(dir, 'project.json'), '{}');
  assert.equal(shell(next(dir).command).status, 0); // parse
  const d = next(dir);
  assert.equal(d.state, 'edit');
  assert.match(d.why, /yok-boyle-ses/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('answer: stores flags, rejects wrong values, accepts defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-agent-'));
  fs.mkdirSync(path.join(dir, 'kayitlar'));
  writeWav(path.join(dir, 'kayitlar', 'ses.wav'), tone(0.2, 200));
  assert.equal(da('answer', dir, '--style', 'jole', '--captions', 'line', '--music', 'none').status, 0);
  assert.deepEqual(readJSON(path.join(dir, 'project.json')), { style: 'jole', captions: 'line', music: 'none' });
  assert.equal(da('answer', dir, '--captions', 'subtitles').status, 1);
  assert.equal(da('answer', dir, '--style', 'no-such-style').status, 1);
  assert.equal(da('answer', dir, '--defaults').status, 0);
  const j = readJSON(path.join(dir, 'project.json'));
  assert.equal(j.style, 'jole', 'defaults never overwrite an answer');
  assert.equal(j.format, '9:16');
  assert.equal(j.audioDir, 'kayitlar', 'a single folder with audio is picked up');
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---------- the instructions themselves ----------
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const cliCommands = [...read('bin/da.mjs').matchAll(/^\s{2}(\w+): \(\) => import/gm)].map((m) => m[1]);

test('every command the instructions mention really exists', () => {
  for (const f of ['SKILL.md', 'AGENTS.md', 'README.md', ...fs.readdirSync(path.join(ROOT, 'docs')).filter((x) => x.endsWith('.md')).map((x) => `docs/${x}`)]) {
    for (const m of read(f).matchAll(/`da ([a-z]+)[ `]/g)) assert.ok(cliCommands.includes(m[1]), `${f}: da ${m[1]}`);
    for (const m of read(f).matchAll(/bin\/da\.mjs ([a-z]+)/g)) assert.ok(cliCommands.includes(m[1]), `${f}: bin/da.mjs ${m[1]}`);
  }
});

test('every file the instructions point to exists', () => {
  for (const f of ['SKILL.md', 'AGENTS.md', 'README.md']) {
    for (const m of read(f).matchAll(/(?:docs|schemas)\/[\w.-]+\.(?:md|json)/g)) assert.ok(fs.existsSync(path.join(ROOT, m[0])), `${f}: ${m[0]}`);
    for (const m of read(f).matchAll(/\]\(((?!http)[^)#]+)\)/g)) assert.ok(fs.existsSync(path.join(ROOT, m[1])), `${f}: ${m[1]}`);
  }
});

test('SKILL.md starts with the loop, stays short and needs no particular model or tool', () => {
  const s = read('SKILL.md');
  assert.ok(s.split('\n').length <= 110, `SKILL.md has ${s.split('\n').length} lines`);
  assert.ok(s.indexOf('da next') < s.indexOf('## '.repeat(1) + 'What people can bring'), 'the loop comes first');
  assert.doesNotMatch(s.replace(/sub-agent[^\n]*optional[^\n]*/gi, ''), /\b(opus|sonnet|haiku|gpt-|claude code|gemini|Agent tool|TodoWrite)\b/i);
  for (const word of ['Anlatıcı', '@sfx', 'music/', 'sfx/', 'audio/', 'dialogue.md']) assert.ok(s.includes(word), `SKILL.md must explain ${word}`);
});

test('agent entry points all lead to SKILL.md', () => {
  for (const f of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md']) assert.match(read(f), /SKILL\.md/, f);
});
