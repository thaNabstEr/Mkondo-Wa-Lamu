# Mkondo wa Lamu

**Steer a mashua, a Lamu dhow, through the mangrove channels of the Lamu archipelago, Kenya, rendered live in the
browser with three.js.**

> Built on **[Sakura Fantasy](https://github.com/billpwchan/sakura-fantasy)** by **Bill Chan**
> ([sakura.billpwchan.art](https://sakura.billpwchan.art/), MIT). Mkondo wa Lamu keeps Sakura's engine, water, light,
> time of day, weather, cinematic camera, place cards and pacing, and replaces its Japanese river valley with Lamu's
> mangrove coast. Our thanks to Bill for making it open.

## Status

Phase 1 (the dhow through the mangroves) is in progress. [`docs/PHASE1_LOG.md`](docs/PHASE1_LOG.md) records every step,
with fixed views compared against the last (`captures/<step>/sheet.jpg`), frame times, draw calls and triangles, and
the list of placeholders still to replace.

So far: the dhow (the Lamu eye on its sail, painted bow boards, a working rudder and tiller) with Sakura's boatman at
the helm; a channel from Amu past Manda toward Matondoni with sandbars on the bends; a mangrove forest of four kinds
(red mangrove, *Rhizophora* clumps, *Bruguiera* grown from its scanned leaves, a lighter tree); sand, mud and the
mangrove floor; steering, the sail for speed, and banks to bump into.

## Controls

| Key | |
|---|---|
| A / D | steer (the tiller swings the other way) |
| W / S | raise / lower the sail |
| Space | moor / set off |
| C | camera: follow, seat, cinema |
| H | hide the interface |

## Run it

```sh
npm install
npm run dev          # http://127.0.0.1:5190
```

`npm run build` writes a static site to `dist/`. The game's assets are in the repository. Scenes open straight from the
URL, as in Sakura: `z` (position along the channel, `60` to about `-2380`), `h` (hour), `w` (weather), `mode`
(`follow`, `seat`, `cinema`), `tier` (`hi`, `lo`). For example `?z=-900&h=16`.

## How it's made

- **Engine:** Sakura Fantasy's, described in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and
  [`docs/SOUND.md`](docs/SOUND.md) (Bill Chan's notes, kept as written).
- **Assets:** every downloaded model and texture is processed before it ships (real scale, fixed materials, lighter
  versions for distance, compressed). Mkondo wa Lamu's scripts are in [`pipeline/lamu/`](pipeline/lamu/README.md);
  Sakura's own pipeline, whose atlas renderer the black mangrove goes through, is in [`pipeline/`](pipeline/README.md).
- **Checks:** `scripts/capture.mjs` (fixed views), `scripts/perf.mjs` (frame times), `scripts/tools/` (smoke test,
  steering, contact sheets).

## Credits and licence

The code is MIT-licensed: see [LICENSE](LICENSE), which keeps Sakura Fantasy's notice alongside ours. Every asset, its
creator and its licence are listed in [CREDITS.md](CREDITS.md); nothing is used under a non-commercial or
no-derivatives licence.
