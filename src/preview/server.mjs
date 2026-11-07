// `da preview <dir>`: a zero-dependency live preview in any browser. It serves the SAME engine modules
// the Node renderer uses (src/engine/*.mjs run unchanged in the browser), the storyboard, the style pack
// and its fonts. Edit build/storyboard.json and press R in the page to reload. No Next.js, no build step.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, log, readJSON, exists } from '../lib/util.mjs';
import { loadConfig } from '../project/config.mjs';
import { loadStyle } from '../style/load.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.png': 'image/png' };

/** Start the server. Returns { url, close }. Used by `da preview` and by the Playwright adapter. */
export function startServer(projectDir, { port = 0, styleId } = {}) {
  const { cfg, files } = loadConfig(projectDir);
  const send = (res, code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  const file = (res, p) => {
    if (!exists(p)) return send(res, 404, 'not found');
    send(res, 200, fs.readFileSync(p), TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream');
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    try {
      if (p === '/' || p === '/index.html') return file(res, path.join(ROOT, 'src', 'preview', 'index.html'));
      if (p.startsWith('/engine/')) {
        const f = path.normalize(path.join(ROOT, 'src', 'engine', p.slice(8)));
        if (!f.startsWith(path.join(ROOT, 'src', 'engine'))) return send(res, 403, 'forbidden');
        return file(res, f);
      }
      if (p === '/storyboard.json') return file(res, path.join(files.build, 'storyboard.json'));
      if (p === '/style.json') {
        const sb = readJSON(path.join(files.build, 'storyboard.json'));
        const st = loadStyle(styleId || cfg.style || sb.style.id, files.dir);
        const out = { ...st, fonts: st.fonts.map((f, i) => ({ ...f, url: `/font/${i}`, path: undefined })) };
        return send(res, 200, JSON.stringify(out), TYPES['.json']);
      }
      if (p.startsWith('/font/')) {
        const sb = readJSON(path.join(files.build, 'storyboard.json'));
        const st = loadStyle(styleId || cfg.style || sb.style.id, files.dir);
        const f = st.fonts[+p.slice(6)];
        return f ? file(res, f.path) : send(res, 404, 'no font');
      }
      if (p === '/audio') {
        const mix = path.join(files.build, 'mix.wav'), voice = path.join(files.build, 'voice.wav');
        return file(res, exists(mix) ? mix : voice);
      }
      return send(res, 404, 'not found');
    } catch (e) { return send(res, 500, e.message); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => {
    const { port: p } = server.address();
    resolve({ url: `http://127.0.0.1:${p}/`, close: () => new Promise((r) => server.close(r)) });
  }));
}

export async function cli(args) {
  const dir = args._[0] || '.';
  const { files } = loadConfig(dir);
  if (!exists(path.join(files.build, 'storyboard.json'))) {
    const { run } = await import('../director/storyboard.mjs');
    await run(dir, args);
  }
  const { url } = await startServer(dir, { port: +(args.port || 5178), styleId: args.style });
  log.step('preview');
  log.ok(`open ${url}  (space = play/pause, ←/→ = one frame, R = reload storyboard, Ctrl+C to stop)`);
  await new Promise(() => {});
}
