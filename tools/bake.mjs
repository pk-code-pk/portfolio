/* Bakes the hero scene into seamless-loop video clips.
   Recovered from the original session's bake.mjs; two deliberate changes:
   - bundled puppeteer, headless (proven working on this box today)
   - deterministic stepping via __capPause handshake instead of double-rAF

   Frames are never written to disk: each screenshot streams into ffmpeg,
   which writes ONE near-lossless intermediate per job (x264 4:4:4 10-bit
   crf 6). The loop assembly + final encodes read that, then it's deleted.
   A free-space guard aborts under MIN_FREE (the bake box can be tight).

   Loop trick: capture dur+xf seconds, then assemble the final clip as
   xfade(tail, head, xf) + middle. The <video loop> wrap point lands on
   blended frames, so the seam is invisible REGARDLESS of whether any of
   the animation's motions are periodic in the window. This is why lap
   arithmetic is not needed.

   usage: node bake.mjs <job> [job...]    jobs: idle-land idle-port
                                                flight-land gya-land
                                                flight-port gya-port
   env:   CHROME=<path>  use this Chromium instead of puppeteer's bundled one
          ANGLE=<backend> GL backend (default metal on macOS, swiftshader
                          elsewhere; capture is deterministic either way)
*/
import { access, mkdir, rm, statfs } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import puppeteer from 'puppeteer';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const TOOLS = dirname(fileURLToPath(import.meta.url));
const SCRATCH = join(TOOLS, 'work');          // intermediates land here; gitignored
const OUTDIR = join(TOOLS, '..', 'hero-video');
const FPS = 60;
const MIN_FREE = 300 * 1024 * 1024;           // pause below this much free disk
// TEST=<seconds>: capture only that much of the first job into work/ and stop
// (per-frame timing check; no assembly, outputs untouched)
const TEST_S = parseFloat(process.env.TEST || '0');

// low disk (often something else on the box): wait for it to recover,
// polling every 15s for up to 10 min, then give up. Pausing mid-capture is
// safe, the scene's clock only moves when we step it.
async function checkDisk(where) {
  const free = async () => { const st = await statfs(TOOLS); return st.bavail * st.bsize; };
  const deadline = Date.now() + 10 * 60 * 1000;
  let f = await free();
  while (f < MIN_FREE) {
    if (Date.now() > deadline) throw new Error(`disk guard (${where}): only ${(f / 2 ** 20).toFixed(0)}MB free after 10 min`);
    console.log(`  disk guard (${where}): ${(f / 2 ** 20).toFixed(0)}MB free, waiting…`);
    await new Promise(r => setTimeout(r, 15000));
    f = await free();
  }
  return f;
}

const JOBS = {
  // the live hero: glass pk + world, no creature (scene ?poke=0). Only the
  // ambient motion (caustics, stars, pk shimmer) moves; the xfade hides the seam.
  'idle-land':   { w: 1280, h: 720,  touch: 0, mode: 'idle',   warm: 4, dur: 14, xf: 1.5 },
  'idle-port':   { w: 720,  h: 1280, touch: 1, mode: 'idle',   warm: 4, dur: 14, xf: 1.5 },
  'flight-land': { w: 1280, h: 720,  touch: 0, mode: 'flight', warm: 4, dur: 18, xf: 1.5 },
  'gya-land':    { w: 1280, h: 720,  touch: 0, mode: 'gya',    warm: 3, dur: 24, xf: 1.5 },
  'flight-port': { w: 720,  h: 1280, touch: 1, mode: 'flight', warm: 4, dur: 18, xf: 1.5 },
  'gya-port':    { w: 720,  h: 1280, touch: 1, mode: 'gya',    warm: 3, dur: 24, xf: 1.5 },
};

const run = (cmd, args) => new Promise((res, rej) => {
  if (cmd === 'ffmpeg') args = ['-hide_banner', '-loglevel', 'warning', '-stats', ...args];
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', c => c === 0 ? res() : rej(new Error(cmd + ' exit ' + c)));
});

async function capture(name, j) {
  await mkdir(SCRATCH, { recursive: true });
  const inter = `${SCRATCH}/${name}.inter.mp4`;
  await rm(inter, { force: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME || undefined,
    args: ['--enable-gpu', `--use-angle=${process.env.ANGLE || (process.platform === 'darwin' ? 'metal' : 'swiftshader')}`, '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--mute-audio', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  await page.goto(`http://localhost:8080/rayquaza-flying-clean.html?capture=1&dpr=2&touch=${j.touch}${j.mode === 'idle' ? '&poke=0' : ''}`,
    { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__heroReady === true', { timeout: 180000 });

  if (j.mode === 'flight') await page.evaluate(() => window.__capSetFlight(true));
  if (j.mode === 'gya') {
    await page.evaluate(() => window.__capSwitchPokemon());
    // async GLB load — wait until the switch actually landed
    await page.waitForFunction('window.__capState().pokemon === "greninja"', { timeout: 180000 });
  }

  // hold the RAF loop; release exactly one tick per step, handshake fully
  // in-page so IPC latency can't land inside it
  await page.evaluate(() => { window.__capPause = true; });
  const step = (t) => page.evaluate((tt) => new Promise((r) => {
    window.__capT = tt;
    window.__capPause = false;
    (function poll() {
      if (window.__mixerLastT === tt) { window.__capPause = true; return r(); }
      requestAnimationFrame(poll);
    })();
  }), t);

  // walk the clock through warm-up so dt-integrating rigs settle
  for (let t = 0; t <= j.warm; t += 1 / FPS) await step(t);

  // PNG frames stream straight into the intermediate encode (stdin)
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png',
    '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv444p10le',
    '-profile:v', 'high444', inter], { stdio: ['pipe', 'inherit', 'inherit'] });
  const encDone = new Promise((res, rej) => enc.on('exit', c => c === 0 ? res() : rej(new Error('ffmpeg intermediate exit ' + c))));
  let encErr = null;
  enc.stdin.on('error', (e) => { encErr = e; });
  const write = (buf) => new Promise((res, rej) => {
    if (encErr) return rej(encErr);
    if (enc.stdin.write(buf)) res(); else enc.stdin.once('drain', res);
  });

  const N = Math.round((TEST_S || (j.dur + j.xf)) * FPS);
  const t0 = Date.now();
  try {
    for (let i = 0; i < N; i++) {
      await step(j.warm + i / FPS);
      await write(await page.screenshot({ type: 'png', optimizeForSpeed: true }));
      if (i % 150 === 0 || (TEST_S && i % 30 === 0)) {
        const free = await checkDisk(`${name} frame ${i}`);
        const rate = (i + 1) / ((Date.now() - t0) / 1000);
        console.log(`  ${name}: frame ${i}/${N}  (${(1000 / rate).toFixed(0)} ms/frame, eta ${((N - i) / rate / 60).toFixed(1)}m, ${(free / 2 ** 30).toFixed(2)}GB free)`);
      }
    }
  } finally {
    enc.stdin.end();
    await browser.close();
  }
  await encDone;
  console.log(`  ${name}: captured ${N} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  return inter;
}

async function assemble(name, j, inter) {
  const durF = j.dur * FPS, xfF = j.xf * FPS;
  // loop = xfade(tail, head, xf) + middle. Playback loop point lands on
  // blended frames, so the wrap is invisible. Each segment is its own
  // input seeked into the intermediate (accurate seek; -0.5 frame so the
  // first kept frame is exactly the wanted one) so nothing gets buffered.
  const fc =
    `[0:v]trim=end_frame=${xfF},setpts=PTS-STARTPTS,fps=${FPS}[b];` +
    `[1:v]trim=end_frame=${xfF},setpts=PTS-STARTPTS,fps=${FPS}[a];` +
    `[b][a]xfade=transition=fade:duration=${j.xf}:offset=0[x];` +
    `[2:v]trim=end_frame=${durF - xfF},setpts=PTS-STARTPTS,fps=${FPS}[m];` +
    `[x][m]concat=n=2:v=1[out]`;
  const at = (f) => String(Math.max(0, (f - 0.5) / FPS));
  const inputs = [
    '-ss', at(durF), '-i', inter,
    '-i', inter,
    '-ss', at(xfF),  '-i', inter,
  ];
  const T = String(Math.min(16, cpus().length));
  console.log(`  ${name}: encoding h264…`);
  await run('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, '-map', '[out]',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-threads', T, '-movflags', '+faststart', `${OUTDIR}/${name}.mp4`]);
  console.log(`  ${name}: encoding hevc…`);
  await run('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, '-map', '[out]',
    '-c:v', 'libx265', '-crf', '21', '-preset', 'medium', '-pix_fmt', 'yuv420p10le',
    '-tag:v', 'hvc1', '-x265-params', `aq-mode=3:pools=${T}:log-level=error`,
    '-movflags', '+faststart', `${OUTDIR}/${name}.hevc.mp4`]);
  console.log(`  ${name}: encoding vp9…`);
  await run('ffmpeg', ['-y', ...inputs, '-filter_complex', fc, '-map', '[out]',
    '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-pix_fmt', 'yuv420p10le',
    '-row-mt', '1', '-threads', T, '-deadline', 'good', '-cpu-used', '2',
    `${OUTDIR}/${name}.webm`]);
}

for (const name of process.argv.slice(2)) {
  const j = JOBS[name];
  if (!j) { console.log('unknown job', name); continue; }
  console.log(`== ${name} ==`);
  await checkDisk(`before ${name}`);
  // REUSE=1: re-run assembly/encodes from an intermediate left in work/
  const kept = `${SCRATCH}/${name}.inter.mp4`;
  const inter = process.env.REUSE && await access(kept).then(() => true, () => false)
    ? kept : await capture(name, j);
  if (TEST_S) { console.log(`TEST capture kept at ${inter}`); break; }
  await assemble(name, j, inter);
  await rm(inter, { force: true });   // intermediates are big; free per job
}
console.log('ALL JOBS DONE');
