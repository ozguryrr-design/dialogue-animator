// Shared loading for stills/render/qa: storyboard + style + adapter.
import path from 'node:path';
import fs from 'node:fs';
import { readJSON, exists } from '../lib/util.mjs';
import { loadConfig } from '../project/config.mjs';
import { loadStyle } from '../style/load.mjs';
import { assertValid } from '../lib/schema.mjs';

export async function loadProject(dir, cli = {}) {
  const { cfg, files } = loadConfig(dir, cli);
  const sbPath = path.join(files.build, 'storyboard.json');
  if (!exists(sbPath) || cli.fresh) {
    const { run } = await import('../director/storyboard.mjs');
    await run(dir, cli);
  }
  const sb = assertValid(readJSON(sbPath), 'storyboard');
  const style = loadStyle(cli.style || cfg.style || sb.style.id, files.dir);
  return { cfg, files, sb, style, sbPath };
}

export async function openAdapter(name, sb, style, opts) {
  if (!name || name === 'node' || name === 'node-canvas') return (await import('./adapters/node-canvas.mjs')).open(sb, style, opts);
  if (name === 'playwright') return (await import('./adapters/playwright.mjs')).open(sb, style, opts);
  throw new Error(`Unknown renderer "${name}". Use node (default) or playwright.`);
}

export function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }
