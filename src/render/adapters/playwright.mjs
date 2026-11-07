// Optional renderer adapter: the same engine running in a real browser (Chromium/Chrome/Edge via Playwright).
// Install once:  npm install playwright-core   (it drives an installed Chrome or Edge; no browser download)
// or             npm install playwright && npx playwright install chromium
// Use:           da render <dir> --renderer playwright
// Slower than the Node adapter (frames travel as PNG); useful to check browser parity or where native
// canvas binaries are unavailable.
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../../lib/util.mjs';
import { startServer } from '../../preview/server.mjs';

async function loadPlaywright() {
  const req = createRequire(path.join(ROOT, 'package.json'));
  for (const m of ['playwright', 'playwright-core']) {
    try { return await import(pathToFileURL(req.resolve(m)).href); } catch { /* try next */ }
  }
  throw new Error('Playwright is not installed. Run: npm install playwright-core   (see docs/RENDERERS.md)');
}

export async function open(sb, style, { scale = 1, projectDir } = {}) {
  const pw = await loadPlaywright();
  const chromium = pw.chromium || pw.default?.chromium;
  let browser = null, lastErr = null;
  for (const opts of [{ channel: 'chrome' }, { channel: 'msedge' }, {}]) {
    try { browser = await chromium.launch({ headless: true, ...opts }); break; } catch (e) { lastErr = e; }
  }
  if (!browser) throw new Error(`Could not start a browser for Playwright: ${lastErr?.message}`);
  const dir = projectDir || path.resolve(style.__projectDir || '.');
  const server = await startServer(dir, { styleId: style.dir });
  const page = await browser.newPage();
  await page.goto(server.url);
  await page.waitForFunction(() => window.__da && window.__da.ready(), null, { timeout: 30000 });
  const width = Math.max(2, Math.round((sb.video.width * scale) / 2) * 2);
  const height = Math.max(2, Math.round((sb.video.height * scale) / 2) * 2);
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const cv = createCanvas(width, height), g = cv.getContext('2d');
  const pngAt = async (t) => Buffer.from((await page.evaluate(([tt, w, h]) => window.__da.frame(tt, w, h), [t, width, height])).split(',')[1], 'base64');
  return {
    name: 'playwright',
    width,
    height,
    async frameRGBA(t) {
      const img = await loadImage(await pngAt(t));
      g.clearRect(0, 0, width, height); g.drawImage(img, 0, 0);
      return Buffer.from(g.getImageData(0, 0, width, height).data.buffer);
    },
    png: pngAt,
    async close() { await browser.close(); await server.close(); },
  };
}
