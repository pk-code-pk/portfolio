# Video hero bake rig

Films `rayquaza-flying-clean.html` into the looping clips in `../hero-video/`.
Everything needed to re-record after a motion change lives here.

## One-time setup

```bash
cd tools && npm install   # puppeteer (bundled Chromium)
```

`ffmpeg` must be on PATH.

## Re-record after changing the scene

```bash
# 1. serve the repo root (Range support — Safari refuses video without it)
node tools/serve.mjs ~/portfolio 8080

# 2. bake (any subset of jobs; ~15-20 min for all four)
cd tools
caffeinate -i node bake.mjs flight-land gya-land flight-port gya-port
```

Outputs land directly in `hero-video/` as `<clip>-<orient>.{mp4,hevc.mp4,webm}`.
Frames go to `tools/work/` (gitignored, safe to delete).

## How it works — read before touching

- **Capture** drives the scene's `?capture=1` mode: the page's clock is
  `window.__capT`, set externally. `tick()` honors `__capPause`, and the
  stepping handshake runs entirely in-page — exactly one rendered tick per
  captured frame, fully deterministic (same inputs → byte-identical frames).
- **The loop is made in the encode, not the capture.** Each job captures
  `dur + 1.5s`, then assembles `xfade(tail, head, 1.5s) + middle`. The
  `<video loop>` wrap point lands on blended frames, so the seam is invisible
  **no matter what the animation is doing**. Do NOT try to make clip length
  match animation periods — gyarados's lap time (~9.2s real vs 8.0s nominal
  `PERIOD`, because `speedMul` eases through turns) and its undulation wave
  are incommensurate, and none of that matters with the crossfade.
- **Durations** (18s flight / 24s gya) are what `index.html`'s player expects;
  change them freely, nothing hardcodes them player-side.
- **Renditions**: h264 crf18 (universal) / HEVC crf21 10-bit `hvc1` tag
  (Safari/iOS — the tag is mandatory, Safari rejects the file without it) /
  VP9 crf32 10-bit (Chrome/Firefox). 10-bit exists because 8-bit 4:2:0
  chroma subsampling eats the thin red tail fins.
- **Scene requirements**: all creature meshes need `frustumCulled = false`
  (three.js culls skinned meshes by bind-pose bounds, which don't follow
  animated bones — parts vanish in portrait's narrow FOV otherwise). Already
  set via `traverse` at model load; keep it if the loaders change.

## Scene capture hooks (in rayquaza-flying-clean.html, `?capture=1` only)

| hook | what |
|---|---|
| `__capT` | external clock (seconds); the page's only time source |
| `__capPause` | holds the RAF loop; stepping releases one tick at a time |
| `__capSetFlight(bool)` | rayquaza figure-8 on/off |
| `__capSwitchPokemon()` | rayquaza ⇄ gyarados (async GLB load — poll `__capState().pokemon`) |
| `__capState()` | `{t, pokemon, rqS/rqL, gyaS/gyaL}` — head arc-distance + curve length per rig |
| `__capRenderOnce()` | force one composer render |
| `&touch=1` | portrait/phone framing (camera dist 63 vs 55) |
| `&dpr=N` | render scale; bake uses 2 → exact 1440×2560 / 2560×1440 |

All dead code on the visitor path (one URLSearchParams check).
