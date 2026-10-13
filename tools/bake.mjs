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
                                                battle-land battle-port
   battle-<orient> films every clip of the easter-egg battle (scene
   &battle=1) in ONE browser session into hero-video/battle/. All captures
   run first, then the encodes (3 at a time): encoding alongside capture
   starved the GPU loop of CPU and tripled ms/frame. Clips whose three
   renditions already exist are skipped, and a leftover intermediate is
   reused, so a stopped bake resumes. BATTLE=<name,name> limits it to some
   clips (names as in battleClips() below, e.g. ray-m1-s0).
   env:   CHROME=<path>  use this Chromium instead of puppeteer's bundled one
          ANGLE=<backend> GL backend (default metal on macOS, swiftshader
                          elsewhere; capture is deterministic either way)
*/
import { access, mkdir, rename, rm, statfs } from 'node:fs/promises';
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

const run = (cmd, args, quiet) => new Promise((res, rej) => {
  if (cmd === 'ffmpeg') args = ['-hide_banner', '-loglevel', 'warning', ...(quiet ? [] : ['-stats']), ...args];
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

/* ── battle ──────────────────────────────────────────────────────────
   Every clip is a whole number of the scene's 2s idle period (BT_P) and
   starts/ends on the shared idle phase, so the site can cut between any
   two clips at the same pk stage with no crossfade. Loops (idle, win) are
   exactly one period: no xfade assembly needed, the motion is periodic. */
const BATTLE_DIR = join(OUTDIR, 'battle');
function battleClips() {
  const L = [{ name: 'intro-s0', clip: 'intro', stage: 0, dur: 4 }];
  for (let s = 0; s <= 5; s++) L.push({ name: `idle-s${s}`, clip: 'idle', stage: s, dur: 2 });
  for (let s = 0; s <= 5; s++) for (const m of ['ray-m1', 'ray-m2', 'lug-m1', 'lug-m2'])
    L.push({ name: `${m}-s${s}`, clip: m, stage: s, dur: 4 });
  for (let s = 3; s <= 5; s++) for (const w of ['ray', 'lug']) {
    L.push({ name: `${w}-faint-s${s}`, clip: `${w}-faint`, stage: s, dur: 4 });
    L.push({ name: `win-${w}-s${s}`, clip: `win-${w}`, stage: s, dur: 2 });
  }
  const only = process.env.BATTLE ? new Set(process.env.BATTLE.split(',')) : null;
  return only ? L.filter(c => only.has(c.name)) : L;
}

async function encodeBattle(name, inter) {
  const T = '3';
  // renditions encode into work/ (same volume) and are renamed over the
  // finals when done: a live site never sees a missing or half-written clip
  const o = `${SCRATCH}/${name}`;
  await run('ffmpeg', ['-y', '-i', inter, '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-threads', T, '-movflags', '+faststart', '-an', `${o}.mp4`], true);
  await run('ffmpeg', ['-y', '-i', inter, '-c:v', 'libx265', '-crf', '23', '-preset', 'fast', '-pix_fmt', 'yuv420p10le',
    '-tag:v', 'hvc1', '-x265-params', `aq-mode=3:pools=${T}:log-level=error`, '-movflags', '+faststart', '-an', `${o}.hevc.mp4`], true);
  await run('ffmpeg', ['-y', '-i', inter, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-pix_fmt', 'yuv420p10le',
    '-row-mt', '1', '-threads', T, '-deadline', 'good', '-cpu-used', '4', '-an', `${o}.webm`], true);
  for (const x of ['.mp4', '.hevc.mp4', '.webm']) await rename(`${o}${x}`, `${BATTLE_DIR}/${name}${x}`);
  await rm(inter, { force: true });
  console.log(`  ${name}: encoded`);
}

async function bakeBattle(orient) {
  const touch = orient === 'port' ? 1 : 0;
  const w = touch ? 720 : 1280, h = touch ? 1280 : 720;
  await mkdir(SCRATCH, { recursive: true });
  await mkdir(BATTLE_DIR, { recursive: true });
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME || undefined,
    args: ['--enable-gpu', `--use-angle=${process.env.ANGLE || (process.platform === 'darwin' ? 'metal' : 'swiftshader')}`, '--enable-unsafe-swiftshader',
      '--hide-scrollbars', '--mute-audio', '--no-sandbox', '--disable-dev-shm-usage',
      '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  await page.goto(`http://localhost:8080/rayquaza-flying-clean.html?capture=1&dpr=2&touch=${touch}&battle=1`,
    { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('window.__heroReady === true && window.__battleReady === true', { timeout: 180000 });
  await page.evaluate(() => { window.__capPause = true; });
  const step = (t) => page.evaluate((tt) => new Promise((r) => {
    window.__capT = tt;
    window.__capPause = false;
    (function poll() {
      if (window.__mixerLastT === tt) { window.__capPause = true; return r(); }
      requestAnimationFrame(poll);
    })();
  }), t);

  const done = (name) => Promise.all(['.mp4', '.hevc.mp4', '.webm'].map(x => access(`${BATTLE_DIR}/${name}${x}`)))
    .then(() => true, () => false);
  const clips = battleClips();
  const t0all = Date.now();
  try {
    for (const [ci, c] of clips.entries()) {
      const name = `${c.name}-${orient}`;
      const inter = `${SCRATCH}/${name}.inter.mp4`;
      if (await done(name)) continue;
      if (!TEST_S && await access(inter).then(() => true, () => false)) { toEncode.push([name, inter]); continue; }
      await checkDisk(name);
      const base = await page.evaluate((cl, st) => window.__capBattle({ clip: cl, stage: st }), c.clip, c.stage);
      // the step before frame 0 lets textures and shaders settle
      await step(base - 2 / FPS); await step(base - 1 / FPS);
      const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png',
        '-framerate', String(FPS), '-i', '-',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '6', '-pix_fmt', 'yuv444p10le',
        '-profile:v', 'high444', inter], { stdio: ['pipe', 'inherit', 'inherit'] });
      const encDone = new Promise((res, rej) => enc.on('exit', x => x === 0 ? res() : rej(new Error('ffmpeg intermediate exit ' + x))));
      const write = (buf) => new Promise((res) => { if (enc.stdin.write(buf)) res(); else enc.stdin.once('drain', res); });
      const N = Math.round((TEST_S || c.dur) * FPS);
      const t0 = Date.now();
      for (let i = 0; i < N; i++) {
        await step(base + i / FPS);
        await write(await page.screenshot({ type: 'png', optimizeForSpeed: true }));
      }
      enc.stdin.end();
      await encDone;
      console.log(`  [${ci + 1}/${clips.length}] ${name}: ${N} frames, ${((Date.now() - t0) / N).toFixed(0)} ms/frame, ${((Date.now() - t0all) / 60000).toFixed(1)}m total`);
      if (TEST_S) { console.log(`TEST capture kept at ${inter}`); continue; }
      toEncode.push([name, inter]);
    }
  } finally {
    await browser.close();
  }
}

const toEncode = [];
async function encodeAll() {
  const t0 = Date.now(); let n = 0;
  const worker = async () => {
    for (let job; (job = toEncode.shift());) {
      await encodeBattle(...job);
      console.log(`  encoded ${++n} (${((Date.now() - t0) / 60000).toFixed(1)}m)`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

for (const name of process.argv.slice(2)) {
  if (name === 'battle-land' || name === 'battle-port') {
    console.log(`== ${name} ==`);
    await bakeBattle(name.slice(7));
    continue;
  }
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
if (toEncode.length && !TEST_S) { console.log(`== encoding ${toEncode.length} battle clips ==`); await encodeAll(); }
console.log('ALL JOBS DONE');
