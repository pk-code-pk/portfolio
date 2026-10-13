/* Stills from the capture-mode scene, for checking framing and effects
   without a full bake. Same clock handshake as bake.mjs.

   usage: node shot.mjs '<query>' <out-prefix> <t> [t...]
     e.g. node shot.mjs 'battle=1&clip=ray-m1&stage=2' work/s 0.5 1.8 3
   env:   PORT (8080), W/H (1280x720 css px; the scene renders at dpr 2 like
          the bake, DPR=1 for quick looks), CHROME=<path>
   The battle hook __capBattle is called with clip/stage from the query
   when present; t is clip-local seconds. */
import puppeteer from 'puppeteer';

const [query, prefix, ...times] = process.argv.slice(2);
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const DPR = +(process.env.DPR || 2);
const port = process.env.PORT || 8080;
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME || undefined,
  args: ['--enable-gpu', `--use-angle=${process.platform === 'darwin' ? 'metal' : 'swiftshader'}`,
    '--hide-scrollbars', '--mute-audio', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { const t = m.text(); if (/\[hero\]|\[battle\]|error/i.test(t)) console.log(t); });
await page.goto(`http://localhost:${port}/rayquaza-flying-clean.html?capture=1&dpr=${DPR}&touch=${H > W ? 1 : 0}&${query}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__heroReady === true', { timeout: 180000 });
const q = new URLSearchParams(query);
if (q.get('battle') === '1') await page.waitForFunction('window.__battleReady === true', { timeout: 180000 });
await page.evaluate(() => { window.__capPause = true; });
const step = (t) => page.evaluate((tt) => new Promise((r) => {
  window.__capT = tt;
  window.__capPause = false;
  (function poll() {
    if (window.__mixerLastT === tt) { window.__capPause = true; return r(); }
    requestAnimationFrame(poll);
  })();
}), t);
let base = 0;
if (q.get('clip')) base = await page.evaluate((c, s) => window.__capBattle({ clip: c, stage: +s }), q.get('clip'), q.get('stage') || '0');
for (const ts of times) {
  const t = base + parseFloat(ts);
  await step(t); await step(t);
  const out = `${prefix}-${ts}.png`;
  await page.screenshot({ path: out });
  console.log(out);
}
await browser.close();
