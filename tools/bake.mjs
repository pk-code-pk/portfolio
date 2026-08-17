/* Bakes the hero scene into seamless-loop video clips.
   Recovered from the original session's bake.mjs; two deliberate changes:
   - bundled puppeteer, headless (proven working on this box today)
   - deterministic stepping via __capPause handshake instead of double-rAF

   Loop trick: capture dur+xf seconds, then assemble the final clip as
   xfade(tail, head, xf) + middle. The <video loop> wrap point lands on
   blended frames, so the seam is invisible REGARDLESS of whether any of
   the animation's motions are periodic in the window. This is why lap
   arithmetic is not needed.

   usage: node bake.mjs <job> [job...]    jobs: flight-land gya-land
                                                flight-port gya-port
*/
import { mkdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import puppeteer from 'puppeteer';

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const TOOLS = dirname(fileURLToPath(import.meta.url));
const SCRATCH = join(TOOLS, 'work');          // frames land here; gitignored
const OUTDIR = join(TOOLS, '..', 'hero-video');
const FPS = 60;

const JOBS = {
  'flight-land': { w: 1280, h: 720,  touch: 0, mode: 'flight', warm: 4, dur: 18, xf: 1.5 },
  'gya-land':    { w: 1280, h: 720,  touch: 0, mode: 'gya',    warm: 3, dur: 24, xf: 1.5 },
  'flight-port': { w: 720,  h: 1280, touch: 1, mode: 'flight', warm: 4, dur: 18, xf: 1.5 },
  'gya-port':    { w: 720,  h: 1280, touch: 1, mode: 'gya',    warm: 3, dur: 24, xf: 1.5 },
};

const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  p.on('exit', c => c === 0 ? res() : rej(new Error(cmd + ' exit ' + c)));
});

async function capture(name, j) {
  const dir = `${SCRATCH}/frames/${name}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--enable-gpu', '--use-angle=metal', '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--mute-audio', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  await page.goto(`http://localhost:8080/rayquaza-flying-clean.html?capture=1&dpr=2&touch=${j.touch}`,
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

  const N = Math.round((j.dur + j.xf) * FPS);
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    await step(j.warm + i / FPS);
    await page.screenshot({ path: `${dir}/f${String(i).padStart(5, '0')}.png`, optimizeForSpeed: true });
    if (i % 150 === 0) {
      const rate = (i + 1) / ((Date.now() - t0) / 1000);
      console.log(`  ${name}: frame ${i}/${N}  (${rate.toFixed(1)} fps, eta ${((N - i) / rate / 60).toFixed(1)}m)`);
    }
  }
  await browser.close();
  return dir;
}

async function assemble(name, j, dir) {
  const durF = j.dur * FPS, xfF = j.xf * FPS;
  // loop = xfade(tail, head, xf) + middle. Playback loop point lands on
  // blended frames, so the wrap is invisible.
  const fc =
    `[0:v]trim=end_frame=${xfF},setpts=PTS-STARTPTS[b];` +
    `[1:v]trim=end_frame=${xfF},setpts=PTS-STARTPTS[a];` +
    `[b][a]xfade=transition=fade:duration=${j.xf}:offset=0[x];` +
    `[2:v]trim=end_frame=${durF - xfF},setpts=PTS-STARTPTS[m];` +
    `[x][m]concat=n=2:v=1[out]`;
  const inputs = [
    '-framerate', String(FPS), '-start_number', String(durF), '-i', `${dir}/f%05d.png`,
    '-framerate', String(FPS), '-start_number', '0',          '-i', `${dir}/f%05d.png`,
    '-framerate', String(FPS), '-start_number', String(xfF),  '-i', `${dir}/f%05d.png`,
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
  const dir = await capture(name, j);
  await assemble(name, j, dir);
}
console.log('ALL JOBS DONE');
