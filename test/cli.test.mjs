// CLI acceptance tests: doctor on an empty folder, and the whole pipeline on a tiny project.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from '../src/lib/util.mjs';
import { findFfmpeg } from '../src/lib/ffmpeg.mjs';

const da = (...args) => spawnSync(process.execPath, [path.join(ROOT, 'bin', 'da.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

test('doctor on an empty folder explains what is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-empty-'));
  const r = da('doctor', dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no dialogue\.md/);
  assert.match(r.stdout, /dialogue\.md\s+Ali: Hello!/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('make: tiny project end to end (needs ffmpeg)', { skip: !findFfmpeg().ffmpeg && 'ffmpeg not available', timeout: 240000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'da-make-'));
  fs.writeFileSync(path.join(dir, 'dialogue.md'), '# Mini\n## Park\nAda: Merhaba! Çay var mı?\nBo: Var. Şeker de var! [mutlu]\n');
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({ voice: 'babble', captions: 'line' }));
  const r = da('make', dir, '--workers', '2');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = path.join(dir, 'out', 'mini.mp4');
  assert.ok(fs.existsSync(out));
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'build', 'qa', 'report.json'), 'utf8'));
  assert.notEqual(report.verdict, 'FAIL', JSON.stringify(report.checks.filter((c) => c.status === 'fail')));
  assert.ok(!fs.existsSync(path.join(dir, 'build', 'tmp')), 'temporary segments must be deleted');
  fs.rmSync(dir, { recursive: true, force: true });
});
