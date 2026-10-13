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
caffeinate -i node bake.mjs idle-land idle-port   # what the site plays
# legacy creature clips (no longer referenced by index.html):
#   node bake.mjs flight-land gya-land flight-port gya-port
```

Outputs land directly in `hero-video/` as `<clip>-<orient>.{mp4,hevc.mp4,webm}`.
No frames touch disk: screenshots stream into ffmpeg, which writes one
near-lossless intermediate per job to `tools/work/` (gitignored; x264 4:4:4
10-bit crf 6, a few MB for the idle clip). The loop assembly and the three
finals read it, then it is deleted. A guard pauses under 300MB free (retries 10 min).
`TEST=2 node bake.mjs idle-land` captures 2s only (timing check, no outputs).
`CHROME=/path/to/chrome` skips the bundled browser. Bake on a machine with a
GPU (the Mac: ~190ms/frame headless); software GL (SwiftShader, the default
`ANGLE` off macOS) works but takes hours per clip.

## The hidden battle (hero-video/battle/)

Rayquaza vs Lugia across a shattering pk, triggered on the site by the
konami code or 5 quick taps on the pk. The scene films it with
`&battle=1` (capture only); the site chains the clips.

```bash
node tools/serve.mjs ~/portfolio 8080
cd tools
caffeinate -i node bake.mjs battle-land battle-port   # ~43 clips each
BATTLE=ray-m1-s0,idle-s1 node bake.mjs battle-land    # just some clips
DPR=1 node shot.mjs 'battle=1&clip=lug-m2&stage=3' work/x 0.5 1.2   # stills
```

All captures run first, then the encodes (3 at a time); a stopped bake
resumes (finished clips skipped, leftover intermediates reused). Clip
names are `<clip>-s<stage>-<orient>.{mp4,hevc.mp4,webm}`:

| clip | len | what |
|---|---|---|
| `intro-s0` | 4s | both fly in over the intact pk |
| `idle-s0..5` | 2s loop | both idle at pk damage stage s |
| `ray-m1/ray-m2-sN` | 4s | Rayquaza: dragon pulse / hyper beam, pk stage N → N+1 |
| `lug-m1/lug-m2-sN` | 4s | Lugia: aeroblast / hydro pump, pk stage N → N+1 |
| `ray-faint/lug-faint-s3..5` | 4s | that one faints, the other roars |
| `win-ray/win-lug-s3..5` | 2s loop | the winner alone |

At stage 5 a move breaks nothing more (the shards jolt), so `-s5` moves
start and end at 5.

**Why the cuts are invisible** (keep these true when editing the scene):
- The world (nebula, stars, glass shimmer) is frozen in battle mode; only
  the creatures, shards and effects move.
- Every idle motion repeats exactly every `BT_P` = 2s (Rayquaza's bone
  rig uses only multiples of 2π/BT_P; Lugia's `battlewait01_loop` is
  time-scaled to span it), and every clip is a whole number of periods,
  starting and ending on that idle. So any clip ending at stage s cuts
  straight into any clip starting at s, and loops need no xfade.
- pk damage is a seeded function of the stage only (fixed impact point and
  shard set per stage), never of which moves got there.
- Everything is a pure function of clip-local time: no dt integration,
  Lugia's clips are sampled at explicit times, particles are analytic.

`pokemon/lugia.glb` is the official-rig Lugia pruned to the battle clips
(`20xxx` set: battlewait, rangeattack01/02, damage01/02, down01, roar01)
with gltf-transform; normals must survive the prune (the source is unlit,
the scene relights it).

The site player (index.html, `battleEgg`) waits for a loop's wrap before
cutting, so a picked move starts within 2s. Hit times in its `HIT` table
must match the scene's `MOVES` (`tHit`).

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
- **Durations** (14s idle; legacy 18s flight / 24s gya) are what `index.html`'s player expects;
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
| `&poke=0` | no creature: model loads (camera framing uses its bounds) but stays invisible; switcher hidden. Also honored outside capture mode (the site's live-3D toggle) |
| `&touch=1` | portrait/phone framing (camera dist 63 vs 55) |
| `&dpr=N` | render scale; bake uses 2 → exact 1440×2560 / 2560×1440 |
| `&battle=1` | battle mode (see above); `__capBattle({clip, stage})` sets the clip and returns its base time, `__battleReady` once Lugia + shards exist |

All dead code on the visitor path (one URLSearchParams check).
