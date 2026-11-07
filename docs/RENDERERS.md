# Renderers

The engine (`src/engine/`) is plain ES modules written against the Canvas2D API only: no `node:` imports, no DOM, no `Math.random`. One function draws a frame:

```js
import { createEnv, renderFrame } from './src/engine/render.mjs';
const env = createEnv(storyboard, style, { createCanvas });   // createCanvas(w, h) -> any canvas
ctx.setTransform(outW / storyboard.video.width, 0, 0, outH / storyboard.video.height, 0, 0);
renderFrame(ctx, env, t);                                     // pure: same (storyboard, style, t) -> same pixels
```

## Adapters
| adapter | when | how |
|---|---|---|
| `node` (default) | always | `@napi-rs/canvas` (Skia, prebuilt binaries for Windows, macOS, Linux). Frames go as raw RGBA through ffmpeg's stdin. About 70 fps with 4–6 workers on a 12-core laptop at 1080×1920. |
| `playwright` | to check browser parity, or where native canvas binaries are unavailable | `npm install playwright-core` (drives an installed Chrome or Edge) or `playwright` + `npx playwright install chromium`, then `da render <dir> --renderer playwright`. It serves the same engine modules, draws in the page, and moves frames as PNG, so it is slower. In our test a still matched the Node render with a mean difference of 0.7/255 (anti-aliasing only). |
| preview page | to scrub and play while editing | `da preview <dir>` → http://127.0.0.1:5178 with play/pause, frame stepping, the shot list, sound from `build/mix.wav`, and **R** to reload the storyboard. No build step and no framework. A Next.js app could host the same modules if you want one, but it is not needed. |

Adapter contract (`src/render/adapters/*.mjs`):

```js
export async function open(storyboard, style, { scale, projectDir }) {
  return { name, width, height,
           frameRGBA(t) /* Buffer | Promise<Buffer>, width*height*4 */,
           png(t)       /* Promise<Buffer> */,
           close() };
}
```

`render.mjs` pipes `frameRGBA` into `ffmpeg -f rawvideo -pix_fmt rgba … -c:v libx264 -tune animation -crf 18 -pix_fmt yuv420p` with BT.709 tags. With `--workers N` it renders N contiguous ranges in worker threads into `build/tmp/seg_XX.mp4`, joins them with the concat demuxer (stream copy), and deletes `build/tmp/`.

## Writing another adapter (e.g. Remotion)
Not included, but the interface is small:
1. In a Remotion composition (`width`, `height`, `fps`, `durationInFrames` from `storyboard.video`), draw to a `<canvas>` in a component. Call `renderFrame(ctx, env, frame / fps)` in a `useLayoutEffect` keyed on `useCurrentFrame()`.
2. Load the fonts listed in `style.fonts` with `FontFace` and wait for them (`delayRender` / `continueRender`).
3. Add the mix as `<Audio src={staticFile('mix.wav')} />`.

Because the engine is deterministic, Remotion's parallel frame rendering is safe.

## Determinism rules for engine code
- No `Math.random`, `Date.now` or global mutable state that depends on render order. Use `rand(...)` / `noise1(...)` from `math.mjs`, seeded by ids and frame numbers.
- A cache (`env.cache`) may only hold values that are pure functions of the storyboard and style.
- `test/determinism.test.mjs` renders frames out of order, twice, and compares the bytes.

## Disk usage
No frame folders are written. A 23 s 1080×1920 video uses about 7 MB for `build/video.mp4`, 7 MB of temporary segments while rendering (deleted afterwards), 4–5 MB of wav files, and about 2 MB for QA sheets. `da clean` removes `build/tmp`; `da clean --all` removes `build/`.
