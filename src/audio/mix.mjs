// `da mix <dir>`: voice + music -> build/mix.wav (music ducked under speech with sidechaincompress,
// two-pass loudnorm to -14 LUFS / -1.5 dBTP), then mux with build/video.mp4 -> out/<title>.mp4
import path from 'node:path';
import fs from 'node:fs';
import { log, rel, readJSON, exists, ensureDir, humanBytes, round } from '../lib/util.mjs';
import { ffmpegOrThrow, ffmpegSync, measureLoudness } from '../lib/ffmpeg.mjs';
import { loadConfig, outputPath } from '../project/config.mjs';
import { run as runMusic } from './music.mjs';

const FMT = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

function loudnormPass1(file, I, TP, LRA) {
  const r = ffmpegSync(['-nostats', '-i', file, '-af', `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, '-f', 'null', '-']);
  const j = r.stderr.slice(r.stderr.lastIndexOf('{'), r.stderr.lastIndexOf('}') + 1);
  return JSON.parse(j);
}

export async function run(dir, cli = {}) {
  const { cfg, files } = loadConfig(dir, cli);
  const sb = readJSON(path.join(files.build, 'storyboard.json'));
  const D = sb.video.duration;
  const M = cfg.mix;
  const voice = sb.audio?.voice ? path.join(files.dir, sb.audio.voice) : null;
  let music = null;
  if (cfg.music.mode === 'synth') { const m = await runMusic(dir, cli); music = m.out; }
  else if (cfg.music.mode === 'own') music = cfg.music.file;
  const report = { duration: D, voice: voice ? rel(voice, files.dir) : null, music: music ? rel(music, files.dir) : null };

  const inputs = [], chains = [];
  let vLabel = null, mLabel = null;
  if (voice && exists(voice)) {
    const vI = measureLoudness(voice).I;
    const g = vI !== null && Number.isFinite(vI) ? -16 - vI : 0;
    inputs.push('-i', voice);
    chains.push(`[${inputs.length / 2 - 1}:a]${FMT},volume=${g.toFixed(2)}dB,apad=whole_dur=${D},atrim=0:${D}[v]`);
    vLabel = '[v]';
    report.voiceLUFS = vI; report.voiceGain = round(g, 2);
  }
  if (music && exists(music)) {
    const mI = measureLoudness(music).I;
    const target = -16 + (cfg.music.volumeDb ?? M.musicDb);
    const g = mI !== null && Number.isFinite(mI) ? target - mI : -12;
    inputs.push(...(cfg.music.mode === 'own' ? ['-stream_loop', '-1'] : []), '-i', music);
    const idx = inputs.filter((x) => x === '-i').length - 1;
    chains.push(`[${idx}:a]${FMT},atrim=0:${D},asetpts=N/SR/TB,volume=${g.toFixed(2)}dB,afade=t=in:d=0.5,afade=t=out:st=${Math.max(0, D - 1.8).toFixed(3)}:d=1.8,apad=whole_dur=${D}[m]`);
    mLabel = '[m]';
    report.musicLUFS = mI; report.musicGain = round(g, 2);
  }
  ensureDir(files.build);
  const pre = path.join(files.build, 'premix.wav');
  let graph;
  if (vLabel && mLabel) {
    // threshold/ratio chosen so speech pulls the bed down by roughly mix.duckDb
    const ratio = Math.max(2, Math.min(20, 1 + Math.abs(M.duckDb) / 2));
    graph = [...chains, `[v]asplit=2[vm][vk]`, `[m][vk]sidechaincompress=threshold=0.015:ratio=${ratio}:attack=20:release=320:makeup=1:level_sc=1[md]`, `[vm][md]amix=inputs=2:duration=first:normalize=0,atrim=0:${D}[out]`].join(';');
  } else if (vLabel || mLabel) graph = [...chains, `${vLabel || mLabel}anull[out]`].join(';');
  else graph = `anullsrc=r=48000:cl=stereo,atrim=0:${D}[out]`;
  ffmpegOrThrow(['-v', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_f32le', '-ar', '48000', pre]);

  const mix = path.join(files.build, 'mix.wav');
  if (vLabel || mLabel) {
    const m1 = loudnormPass1(pre, M.lufs, M.truePeak, 11);
    const ln = `loudnorm=I=${M.lufs}:TP=${M.truePeak}:LRA=11:measured_I=${m1.input_i}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=summary`;
    ffmpegOrThrow(['-v', 'error', '-y', '-i', pre, '-af', `${ln},${FMT}`, '-ar', '48000', '-c:a', 'pcm_s24le', mix]);
  } else fs.copyFileSync(pre, mix);
  fs.rmSync(pre, { force: true });
  report.mix = measureLoudness(mix);
  // loudnorm's linear mode can land a little above the true-peak target: pull the whole mix down if so
  if (report.mix.TP !== null && report.mix.TP > M.truePeak + 0.2) {
    const tmp = path.join(files.build, 'mix_tp.wav');
    ffmpegOrThrow(['-v', 'error', '-y', '-i', mix, '-af', `volume=${(M.truePeak - report.mix.TP - 0.1).toFixed(2)}dB`, '-c:a', 'pcm_s24le', tmp]);
    fs.renameSync(tmp, mix);
    report.peakTrim = round(M.truePeak - report.mix.TP - 0.1, 2);
    report.mix = measureLoudness(mix);
  }

  const video = path.join(files.build, 'video.mp4');
  if (!exists(video)) throw new Error('build/video.mp4 is missing — run `da render` first.');
  const out = path.resolve(cli.out || outputPath(cfg, files, sb.meta.title));
  ensureDir(path.dirname(out));
  ffmpegOrThrow(['-v', 'error', '-y', '-i', video, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', String(D), '-movflags', '+faststart', out]);
  report.out = rel(out, files.dir);
  report.size = fs.statSync(out).size;
  return { report, out, files };
}

export async function cli(args) {
  log.step('mix');
  const { report, out } = await run(args._[0] || '.', args);
  if (report.voice) log.info(`voice ${report.voice}: ${report.voiceLUFS?.toFixed(1)} LUFS, gain ${report.voiceGain} dB`);
  if (report.music) log.info(`music ${report.music}: ${report.musicLUFS?.toFixed(1)} LUFS, gain ${report.musicGain} dB (ducked under speech)`);
  log.ok(`mix: ${report.mix.I} LUFS integrated, true peak ${report.mix.TP} dBTP, LRA ${report.mix.LRA} LU`);
  log.ok(`final video -> ${rel(out)} (${humanBytes(report.size)})`);
  return 0;
}
