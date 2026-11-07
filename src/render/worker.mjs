// Worker thread: renders one contiguous frame range into its own mp4 segment.
import { parentPort, workerData } from 'node:worker_threads';
import { readJSON } from '../lib/util.mjs';
import { loadStyle } from '../style/load.mjs';
import { renderRange } from './render.mjs';

const { sbPath, styleId, projectDir, scale, f0, f1, out, crf, preset } = workerData;
const sb = readJSON(sbPath);
const style = loadStyle(styleId, projectDir);
let pending = 0;
await renderRange({
  sb, style, scale, f0, f1, out, crf, preset, renderer: 'node',
  onProgress: () => { pending++; if (pending >= 10) { parentPort.postMessage({ progress: pending }); pending = 0; } },
});
if (pending) parentPort.postMessage({ progress: pending });
