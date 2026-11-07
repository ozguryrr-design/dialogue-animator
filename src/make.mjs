// `da make <dir>`: the whole pipeline, non-interactive, with every default reported in build/decisions.md.
import path from 'node:path';
import { log, rel, c, readText, exists } from './lib/util.mjs';
import { runChecks, projectChecks, printChecks } from './doctor.mjs';

export async function cli(args) {
  const dir = args._[0] || '.';
  const t0 = Date.now();
  log.step('doctor');
  const { checks, styles } = runChecks(dir);
  await projectChecks(dir, checks, styles);
  const fails = checks.filter((x) => x.status === 'fail');
  if (fails.length) { printChecks(fails); throw new Error('Fix the items above first (run `da doctor` for details).'); }
  log.ok('environment and project look fine');
  const steps = [
    ['parse', () => import('./project/parse.mjs')],
    ['cast', () => import('./project/cast.mjs')],
    ['align', () => import('./audio/align.mjs')],
    ['board', () => import('./director/storyboard.mjs')],
    ['render', () => import('./render/render.mjs')],
    ['mix', () => import('./audio/mix.mjs')],
    ['qa', () => import('./qa/qa.mjs')],
  ];
  let qaCode = 0;
  for (const [name, load] of steps) {
    const mod = await load();
    const code = await mod.cli({ ...args, _: [dir] });
    if (name === 'qa') qaCode = code;
    else if (code) throw new Error(`step "${name}" failed`);
  }
  const { files } = (await import('./project/config.mjs')).loadConfig(dir, args);
  console.log(c.bold(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)} s.`));
  const dec = path.join(files.build, 'decisions.md');
  if (exists(dec)) console.log(c.dim(readText(dec).split('\n').filter((l) => l.startsWith('|')).join('\n')));
  log.info(`QA report: ${rel(path.join(files.build, 'qa', 'report.md'))}`);
  return qaCode;
}
