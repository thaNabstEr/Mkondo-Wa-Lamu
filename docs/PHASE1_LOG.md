# Phase 1 log

Every step ends with the fixed views (`scripts/views.json`, captured by `scripts/capture.mjs`, sheet by
`scripts/tools/sheet.mjs`) and a performance run (`scripts/perf.mjs`). Machine: Apple M1 Pro, Chrome, 1920×1080.
Perf figures are p50 / p95 frame time (ms), the governor's render scale, draw calls and triangles per frame.

## Step 0 · Repo and tools (2026-10-28)

- Git repo in the project root; Sakura Fantasy is the `upstream` remote, checked out at `3d367e9` (main). `git diff
  upstream/main` shows every change we make. `Context/` stays ignored.
- Blender 5.2.3 LTS (system install; bundles OpenImageIO 3.1.13, numpy 2.3.4).
- In `.cache/tools/` (ignored; `source .cache/tools/env.sh` puts them on PATH):
  - KTX-Software 4.4.2, `KTX-Software-4.4.2-Darwin-arm64.pkg` from the KhronosGroup GitHub release; signed by The
    Khronos Group and Apple-notarised; sha256 `500bd8f9…2c3c`. Unpacked with `pkgutil --expand-full`, not installed.
  - libwebp 1.6.0 (`cwebp`), `libwebp-1.6.0-mac-arm64.tar.gz` from downloads.webmproject.org; sha256 `bc6bf84c…b8f2`.
    The `.asc` signature was downloaded but not checked (no gpg on this machine).
  - ffmpeg: deferred to step 10 (only needed if a new recording is added).

## Step 1 · Sakura baseline

Unchanged Sakura, `captures/sakura-baseline/` (sheet: `sheet.jpg`). Two changes to Sakura's capture tool so the
stills are clean: the interface is hidden before every shot, and four simulated seconds run before the first one
(it was black while the scene faded in).

| View | Framing (camera relative to the boat) |
| --- | --- |
| v1-astern-golden | just astern, eye height, 17:00 |
| v2-follow-midday | Sakura's follow camera, noon |
| v3-waterlevel | from the bow at 0.5 m, looking down the channel (the `channel-water-level.png` view) |
| v4-bank-low | low, side-on toward the bank |
| v5-aerial | 70 m up, looking down the channel |
| v6-dusk-wide | wide, from ahead, 18:20 |
| v7-night | follow camera, 21:30 |

Perf, unchanged Sakura (full tier, clear, summer):

| Stretch | @2× p50 / p95 | scale | @1× p50 / p95 | scale | calls | triangles |
| --- | --- | --- | --- | --- | --- | --- |
| z −100 mist shallows | 83.4 / 99.6 | 0.88 | 51.2 / 59.4 | 0.88 | 2083 | 33.0 M |
| z −400 cherry avenue | 66.8 / 83.6 | 0.88 | 44.2 / 51.4 | 0.68 | 1984 | 32.0 M |
| z −950 village | 50.1 / 67.2 | 0.68 | 33.4 / 40.8 | 0.60 | 1521 | 23.1 M |
| z −1400 gorge | 49.5 / 50.7 | 0.60 | 27.3 / 34.6 | 0.50 | 1227 | 21.6 M |

Finding: on the M1 Pro, Sakura runs at 12–20 fps at @2× and 20–37 fps at @1×, and dropping resolution barely helps,
so it is bound by geometry (21–33 M triangles a frame), not pixels. (Sakura's published 60 fps is on an M4 Max.) The
mangrove world must keep its triangle count well under Sakura's for a smooth desktop frame on this class of machine.

## Step 2 · The Japanese world removed

Removed: the drum bridge, pagoda, hall, belfry, village houses, stone embankment, river torii, the great torii,
wayside shrine and hokora, stone lanterns (`architecture.js` deleted), the waterfall (`waterfall.js` deleted), the
komainu and jizō statues (code and models), the sacred tree, every Japanese tree species from placement (cherry,
maple, konara, black pine, sugi, bamboo, azalea), susuki, the petal rafts on the water and petal carpet on the
banks, falling petals and maple leaves, foxfire wisps, floating and sky lanterns, fireworks, the temple-bell event,
and the boatman's straw rain cape (it was built with the architecture kit; it only came on in rain and snow).
`sites.js` keeps its API (`SITES`, `BLOCK`, `blocked`) with nothing registered, ready for piers and lodges later.

Kept, at the owner's request (2026-10-28): the bank flowers (nanohana and higanbana: Japanese species, so they go on
the placeholders list) and the rocks, stumps and fallen trunks. Also kept for now: meadow grass and reeds, fireflies
and birds. Still Japanese and replaced in later steps: the river valley and lake (step 3), the tomabune and the
passenger (step 4), the dead tree code in `trees.js` (step 7), place names, haiku, kanji HUD and sounds (steps 9–10).

Checks: `scripts/tools/smoke.mjs` boots with no errors or warnings and sails the whole 2,917 m route into the next
lap. Views: `captures/step2-stripped/sheet.jpg` (each row: Sakura | now). v3 was reframed further ahead of the bow
(it was inside the hull) and re-shot from unchanged Sakura (an `upstream` worktree in `.cache/sakura-upstream`).

| Stretch | @2× p50 / p95 | scale | calls | triangles |
| --- | --- | --- | --- | --- |
| z −100 | 33.3 / 34.1 | 0.77 | 429 | 5.5 M |
| z −400 | 16.7 / 33.5 | 0.60 | 425 | 5.5 M |
| z −950 | 16.7 / 17.5 | 0.50 | 396 | 5.9 M |
| z −1400 | 16.7 / 17.5 | 0.55 | 434 | 5.9 M |

With the trees gone the frame is a sixth of Sakura's triangles and a fifth of its draw calls, at up to 60 fps. The
render scale was still 0.5–0.77 when measured, 9 s after each jump; whether the governor climbs back to full scale
over a longer run is not yet checked.

## Step 3 · The channel reshaped

`layout.js` now describes a flat mangrove coast instead of a mountain valley. The route is 2,450 m (Sakura's was
2,917 m including the lake loop) and runs:

| z (m) | Stretch | Water half-width |
| --- | --- | --- |
| +60 … −250 | Lamu's broad channel | 46 → 26 m |
| −250 … −650 | the Manda mangroves: S-bends, first sandbar at −300 | 26 → 20 m |
| −700 … −1120 | the first narrow creek | 11 → 6.5 m |
| −1120 … −1560 | a wider reach, bending; second sandbar at −1250 | 12 → 34 m |
| −1600 … −1950 | the second narrow creek | 10 → 8 m |
| −1950 … −2380 | the mouth, opening into a bay with three low islands; the route ends drifting there | 30 → 260 m |

- Land is mud 0.4–0.7 m above the water, rising to about 2 m only far behind the banks; no hills or cliffs. All
  height will come from the canopy.
- Sandbars sit on the inside of their bends (worked out from the centreline's curvature) and crest about 0.2 m above
  the water (checked numerically and in v5/v9). They still show Sakura's pebble texture; sand comes with the bank
  materials (step 7).
- The day runs from 06:20 at Lamu to 18:30 on the open water, so the route ends at sunset with the sun setting ahead
  and to the right. The boat eases to a drift over the last 140 m.
- The water surface and terrain were extended (water to 8 × 7.8 km, land to ±3 km and z −3,800) so the land's edge
  is not visible across the open water.
- Limitation: Sakura's channel is a function x(z), so bends cannot loop back on themselves the way the aerial
  reference's meanders do. Fine for Phase 1; the channel maze (later phase) needs a proper path representation.

Place names. Sources checked: Wikipedia "Lamu" ("The original name of the town is Amu"); Wikipedia "Lamu Island"
(Matondoni "lies at the northwest coast of the island, 7.3 km west of Lamu"; Manda Island neighbours Lamu); the
UNESCO decision on Lamu Old Town (protect "the mangroves opposite the Lamu seafront on the shores of the
neighbouring Manda Island"). No source named the creeks in between: the name "Mkanda" could not be confirmed.

| Card | Kiswahili | English | Status |
| --- | --- | --- | --- |
| 1 | Amu | Lamu | verified |
| 2 | Mikoko ya Manda | The Manda Mangroves | Manda verified; "mikoko" = mangroves |
| 3 | Mkondo Mwembamba | The Narrow Creek | placeholder (descriptive) |
| 4 | Maji Mapana | The Wide Reach | placeholder (descriptive) |
| 5 | Matondoni | Toward Matondoni | verified |

The place cards themselves do not show yet: Sakura only shows a card with a haiku, and the methali arrive in step 10.
The journey scroll on the left shows the new names. Weather is pinned to clear until the moods (step 9). Sound: places
not on this route now weigh nothing, so the bells, chant, gagaku and festival are silent ahead of their removal; the
cicadas were re-tied to the whole channel by day.

Views: `captures/step3-channel/` with v4 moved into the first creek (z −900) and v6 onto the open water (z −2250);
new: v8 (high, down the channel toward the sunset) and v9 (the second sandbar). Smoke test passes (no errors; lap
turns over).

| Stretch | @2× p50 / p95 | scale | calls | triangles |
| --- | --- | --- | --- | --- |
| z −100 Amu | 33.3 / 49.9 | 0.88 | 462 | 8.0 M |
| z −400 Manda | 16.7 / 49.5 | 0.68 | 457 | 8.5 M |
| z −900 creek | 16.7 / 17.4 | 0.51 | 438 | 8.0 M |
| z −1300 reach | 16.7 / 17.4 | 0.56 | 442 | 8.4 M |
| z −2250 open | 16.7 / 17.4 | 0.56 | 275 | 6.1 M |

Triangles rose from 5.5 M to about 8 M: the flat banks give Sakura's meadow grass far more ground to cover. The grass
is replaced by the mangrove floor in step 7.

## Steps 4 and 5 · The dhow, and the boatman aboard

Done together: the boatman's pose is driven by the boat (Sakura's sculling oar belonged to the tomabune).

**Owner's reference photos** saved for step 7: `Context/Image References/creek-root-tunnel.jpg` (a straight creek
walled by stilt roots under an arching canopy) and `creek-canopy-canoe.jpg` (a narrow creek with the canopy closed
overhead).

**The dhow** (`pipeline/lamu/build-dhow.sh`, which runs `textures.mjs`, `dhow.py` and `pack-dhow.mjs`):
- Source: "Dhow" by gogiart on Sketchfab, CC BY 4.0 (creator checked on the page; credited in `CREDITS.md`).
  503,388 triangles in 15 parts; each part identified from renders of it alone (sail, rings, painted topsides,
  planking, interior, decks, mast and yard, ropes, rudder and its irons, fittings).
- Scale. No source gives a mashua's length (the nearest figure found is a Matondoni-built dhow of 34 ft, which is
  larger than a mashua). Following the owner's note, it is sized against Sakura's boatman (measured in the game: 1.52 m
  standing in his sculling stance): ×1.1, so 6.6 m overall, 2.0 m beam, the rail 0.94 m above the floor. Waterline
  just below the painted topsides; it runs 4.98 m with a 1.86 m beam.
- Turned into Sakura's frame (bow toward +z, waterline y = 0). The sail is its own node, for raising and lowering in
  step 6.
- Tiers: quick 62,902 triangles (2.33 MB, 1K ETC1S, meshopt), full 172,113 (7.20 MB, UASTC, meshopt). Sakura's
  tomabune was 6.0 MB / 26.6 MB. The full tier swaps in whole (its own geometry, not just textures).
- Before/after renders from fixed views (`pipeline/lamu/render.py`) show the shape, paint and sail unchanged in both
  tiers.
- **The Lamu eye** on both faces of the sail: `emblem.png` cut to its outer ring, on a decal fitted to the sail's
  surface by ray casts (alpha-masked, so the sail shows round it).
- **The bow boards**: an original design drawn in code (blue board, white medallions joined by a running vine, a white
  band, a red stripe; natural timber below), fitted to both bows by ray casts along a smoothed sheer line. Nothing is
  traced from the decoration photograph.
- Materials: matte wood, rope and sail; painted boards a little glossier; iron partly metallic; the eye cut out.
- `src/world/hull.js` (generated) gives the water shader the hull's 36 waterline half-widths, an outline and a box,
  replacing the tomabune's hand-entered numbers in `water.js`, and gives `boat.js` the deck profile.

**The boatman** (Sakura's, dressed as he is) sits at the helm: on the forward edge of the raised stern deck, feet on
the low platform before it, hands on his knees, looking ahead and to either bank. The rig gained one option for this
(`pose({ feet })` in `figures.js`); his legs and arms are still Sakura's two-bone IK. Sakura's passenger, her wagasa
and the tomabune are gone (models deleted, about 320 lines of their materials removed from `figures.js`). The seat
camera now sits amidships at a seated eye height.

Views: `captures/step4-dhow/` (sheet), close-ups in `captures/step4-dhow/close/`. v1 (just astern) was moved back to
10 m and up to 2.4 m: at 4.5 m it looked straight into the lateen sail. Smoke test passes; `npm run build` passes.

Performance could not be measured fairly this step: **macOS Low Power Mode is on** (`pmset`: lowpowermode 1), which
caps Chrome at 30 fps; a blank page measures exactly 30 fps (`scripts/tools/raf.mjs`). Every stretch measured
33.3 ms for that reason. Draw calls and triangles are unaffected:

| Stretch | calls | triangles |
| --- | --- | --- |
| z −100 Amu | 413 | 7.2 M |
| z −400 Manda | 408 | 7.7 M |
| z −900 creek | 389 | 7.1 M |
| z −1300 reach | 393 | 7.6 M |
| z −2250 open | 226 | 5.3 M |

## Placeholders and follow-ups (kept up to date)

- Cicadas (and crickets, frogs): Japanese recordings, to be replaced by Lamu sounds.
- The boatman's clothes (hanten, sugegasa): Sakura's; a later phase dresses him as a nahodha.
- The boatman's steering hand follows the tiller by IK only (no grip animation); his left hand rests on his knee.
- The boatman's hanten still carries Sakura's cherry-blossom crest on the back and the white pattern at the hem
  (only the collar's kanji were blanked, as asked).
- The dhow carries no lamp at night (Sakura's bow lantern went with the tomabune).
- Place names "Mkondo Mwembamba" and "Maji Mapana" are descriptive placeholders.
- Mobile: the dhow's quick tier is about 63k triangles; the phone budget for player boats is about 10–20k.
- Sakura's credits for assets now removed (statues, tomabune, Japanese recordings, the flower and grass scans) to be
  pruned from `CREDITS.md`, and its pipeline scripts for the tomabune and passenger to be retired, at the end of Phase 1.
- The black mangrove is a tree grown in code to carry the scanned leaves (the scan has no trunk or limbs); its bark is
  the red mangrove's bark image, darkened.
- Draw calls rose to 550-970 a frame with four species per card bin; Amu and Manda sit at the 33 ms line (p50 33.4 and
  32.4 ms), not yet under it.

## Step 6 · Steering, the sail, and banks you can bump into

- **The sail sets the speed.** W raises it and S lowers it, a little at a time while held (2.5 s from lowered to
  full). Speed through the water runs from 0.4 m/s with the sail down to 5.6 m/s with it fully up (it starts at three
  quarters). Space still moors her and sets off again. As the sail comes down, the cloth (with the eye) gathers onto
  the yard in the vertex shader; mostly furled, it stops casting a shadow. Stills: `captures/step6-steering/sail-*.png`.
- **Steering** is still Sakura's: A and D move the boat across the channel with some inertia, and the camera, the
  journey's places and the time of day follow the channel as before.
- **The banks and the sandbars stop her.** Eight points round the hull (from `hull.js`) are tested every frame: the
  boat is aground wherever the bed under any of them rises above 0.35 m below the surface. The banks and the sandbars
  are the same rule, since both are terrain. On a touch the boat slides to the nearest offset where she floats, her
  sideways way rebounds a little, she loses speed with the force of the knock, she yaws and heels a touch, the camera
  shakes for a moment and a dull wooden thud and a slosh play (synthesised in `sound.js`).
- Checked by `scripts/tools/steer.mjs`, which drives the keys: hard right then hard left in the first creek bumped
  once each side; lowering the sail took her from 2.3 to 0.41 m/s and raising it fully to 5.19 m/s; pushing onto the
  first sandbar bumped nine times, and the hull never went more than 8 mm into its 0.35 m clearance. No page errors;
  the smoke test passes.
- Not done here: the interface's key hints and About text still describe Sakura's controls (step 10).

## Step 7a · The mangrove forest (first pass, for the owner to look at)

Brought forward in effort after the owner's note that the trees must read as a forest; sized from their two photos.

**The channel narrowed**: creeks to 4.5–5 m half-width (9–10 m of water; the root walls stand a metre into it,
leaving about 7 m for a 2 m boat), the Manda stretch and the wide reach to 14–20 m.

**The trees** (`pipeline/lamu/mangrove.py`, `pack-mangrove.mjs`):
- Red mangrove ("red-mangrove-tree", SAVIA_Colombia, CC BY 4.0; the page's credit, not the GLB's `ingdearco`):
  405,661 triangles. Scaled so the crown top is 7.4 m above the root plane, with the stilt roots standing about
  2.6 m above it (the photographs show a 1.5–3 m root wall under a 6–10 m canopy); trees vary 0.85–1.35 in size.
  Leaves, twig sprays and propagules are cut-outs (they were alpha-blended); the bark is opaque and was toned darker
  and browner to match the photographs. Its "cap" material draws nothing (clear texture) and was dropped (9,000
  triangles). Tiers: near 33,614 triangles (12% of the 44,000 leaf cards, each enlarged to keep the crown's cover;
  the wood decimated), mid 8,920, and far cards: three upright cards and a canopy card seen from above, rendered
  from the tree itself (16 triangles).
- Light mangrove ("Mangrove Tree", Nice2meetU2, CC BY 4.0): its leaf texture is a JPEG with no alpha (the leaves
  drew as solid squares), so the cut-out is keyed from the colour; its crown is sparse, so it is used only as far
  cards, about a fifth of the trees in the back ranks. (The brief planned it as far filler; that is what it is.)

**The forest** (`src/world/mangroves.js`, `place-trees.js`): a bank rank of red mangroves every 3–4 m along both
banks, rooted from 1.2 m into the water to 1 m up the bank and leaning 0.1–0.25 rad out over the channel (2,531
trees); behind them a jittered grid out to 700 m, opening from 5 m to 10 m spacing (60,126 trees). Bank trees near
the camera are real geometry from two pools (near tier within 30 m, mid within 100 m); every other tree, and every
tree in the water's reflection, is its cards. The cards fade from upright to the canopy card as the camera looks
down, so the aerial views see a roof of leaves. Everything sways in the shared wind.

**Ground**: Sakura's meadow grass and reeds are gone (hidden under the canopy, they were most of the triangles);
the bank flowers stay in a sparse band at the water's edge, and the waterline rocks stay (owner's request). Ferns
and the inland boulders went (not mangrove ground); a few stumps and fallen trunks lie among the roots. Japanese
bark, roof, wall and plank textures and the tree atlases were removed (36 files).

Views: `captures/step7a-forest/`. v4 moved in behind the boat (its 12 m side offset was inside the forest now the
creek is narrow) and v7 (night) to the wider Manda stretch for the same reason.

Perf (Low Power Mode now off; @2×):

| Stretch | p50 / p95 | scale | calls | triangles |
| --- | --- | --- | --- | --- |
| z −100 Amu | 37.3 / 44.2 | 0.77 | 701 | 9.5 M |
| z −400 Manda | 34.9 / 40.0 | 0.68 | 679 | 10.5 M |
| z −900 creek | 24.5 / 29.2 | 0.53 | 598 | 10.4 M |
| z −1300 reach | 22.4 / 26.7 | 0.50 | 570 | 9.9 M |
| z −2250 open | 15.7 / 23.4 | 0.50 | 420 | 7.5 M |

About twice as fast as unchanged Sakura on this machine (50–83 ms). In the creek the triangles are: near trees
2.8 M, mid trees 1.6 M, cards 2.0 M, terrain about 3 M, the rest 1.4 M (all passes). Still to do (7b): the forest
mass from the *Rhizophora* scan through Sakura's atlas pipeline, mud and sand textures on the banks and sandbars, the
dark wet band; and more performance work at the broad start (Amu, Manda) where it is over the 33 ms budget.

## Review 1 · The owner's notes after step 7a (2026-10-28)

The owner's review: keep the water; restore the tiller; use all the mangrove assets and break up the hedge; sand on
the bars; fix the cyan hull, the black sail back, the smeared deck and the boatman's kanji. Views:
`captures/review1/sheet.jpg` (each row: step 7a | now); close-ups in `captures/review1-tiller/`,
`captures/review1-forest/` and `captures/review1-boat/`.

**1 · The tiller.** The downloaded dhow never had one: no part of it is a tiller (checked against the renders of each
part), so nothing was lost in processing. Its rudder hangs on irons along a hinge raked about 26° aft (fitted through
the irons' three pins). `dhow.py` now makes the rudder blade its own node and adds a fitting in the blade's own wood: a
rudder head rising along the hinge just aft of the sternpost to 1.38 m, and a tiller 0.82 m long slotted through it,
running forward over the stern at 1.32 m (raised to clear the two knobbed posts at the stern). 24 triangles; the hinge
and the grip go into `hull.js`. In the game the rudder turns about the hinge with the helm (±0.3 rad, eased): D swings
the tiller to port and the blade to starboard, A the other way, so the tiller moves opposite to the turn.
`scripts/tools/steer.mjs` logs it: +0.30 with D, −0.30 with A, back to 0 on release. The stern has no raised deck to
sit on (the boatman had been perched on a narrow centre plank), so he now sits on the port gunwale at the stern,
turned a little inboard, his feet on the floor, his right hand following the tiller by the existing two-bone IK and
his left on his knee (`captures/review1-tiller/`: side, port quarter, and from astern with A and D held). The capture
tool gained `keys` per shot, held through it.

**4-8 · The forest.** Both CC0 scans were opened for the first time and identified by inspection and by the metadata
in the files, which matches their Sketchfab pages ("CC0 ヤエヤマヒルギ Red Mangrove, Rhizophora mucronata" and "CC0
オヒルギ Black Mangrove, Bruguiera gymnorhiza", both ffish.asia / floraZia.com). Neither is what the brief expected:
- The *Rhizophora* file is a field photogrammetry scan of a whole clump (crown, stilt roots and the mud it stands on,
  1.38 M triangles, one 1K texture). Its leaves are melted into lumps, as photogrammetry makes of foliage, so it can
  only be seen far off: `mangrove.py` finds its ground, cuts the mud away, greens its grey lumps and renders it as far
  cards (a clump 21 m across, 8.8 m high). These clumps stand 7-26 m behind the bank rank, a second wall of roots and
  crown, and in patches further back.
- The *Bruguiera* file is not a tree: it is two single leaves and two flowers, each at several levels of detail, with
  the colour checker. That is exactly what Sakura's atlas pipeline is for. `bruguiera_sprays.py` lays the real leaves
  out on twigs in opposite pairs crowding the shoot tips, as the species grows them, and renders four spray cells with
  `pipeline/veg/atlaslib.py` (the fourth with its red-calyxed flowers); the scanned leaves are full of holes where the
  scan found no surface, closed in the image. `bruguiera_tree.py` grows a tree to carry them, as Sakura grows its
  trees: a straight trunk with low buttresses, knee roots looping out of the mud, fifteen tiered limbs making a narrow
  cone, 808 spray cards; then it goes through the same tiers as the red mangrove (4,775 / 1,207 triangles and cards).
  It stands in stands of its own along the bank and in patches inland.
- All four kinds now mix through the forest, each tree with its own tint (lighter or darker, warmer or cooler,
  drifting in stands) and the bank rank broken up: sizes rise and fall in stands, low stretches of young trees dip the
  canopy (the roots carry on), lean runs from almost none to 0.45 rad, the edge wanders, and 3% are emergents up to
  1.8× (`place-trees.js`).
- From above: each species' canopy card has its gaps between the limbs closed, a soft rim, and is a quarter larger
  than the crown, so crowns overlap. The six-armed stars seen from the air were the far cards' shadows (three crossed
  boards): their shadows now come from the canopy card once the sun is more than about 20° up. The ground under the
  forest is a dim olive litter, not near-black.
- The root wall: the mid tier keeps the stilt roots (the wood below 2.8 m) at 4.5% instead of 1% (red mid tier 8,920
  → 10,261 triangles), the far cards' bark is tinted as the near trees' is (it was rendered pale grey), and the red
  mangrove's bark is darker and browner (v2, v4). The separate root-wall strip planned for this turned out not to be
  needed and was not built.
- The bank flowers are gone (with Sakura's grass and flower code and atlases); the rocks stay.

**9 · Sand.** The pebbles are gone. In the channel, wherever the bed shelves up toward the surface (the shallows and the
sandbars, crests included) the ground is sand ("Damp Beach Sand 02", Poly Haven, CC0, lightened to Lamu's pale coral
sand); the deep bed is dark silt; the banks are mud with puddles and the forest floor wet mud with fallen leaves (two
TextureCan textures, CC0, from `Context/3D Assets/`, `pipeline/lamu/ground.sh`). v9 shows the sandbar. (Fetching the
sand exposed a bug in `scripts/fetch-assets.mjs`: with a space in the project's path it wrote into a stray
`30ml%20Gaming` folder beside the project, re-downloading Sakura's removed textures there. Fixed, the stray folder
removed, and the removed textures taken off its list.)

**10 · The cyan hull.** The glow was the water's own refraction: pale planks just under the clear teal surface. Where
the water sees the dhow's own bottom through it, the path is now longer and the absorption greener-brown, and the
hull's below-waterline darkening is deeper (`captures/review1-boat/hull-side-low.png`).

**11 · The sail.** The cloth and the eye take the sun through the weave on the face turned away from it, fading as the
sail is lowered (`sail-yaw300.png`: into the sun). Found on the way: the rings lacing the sail to the yard shared the
hull's rope material and so never furled; the sail now takes its own copy, and they gather up with the cloth
(`sail-lowered.png`).

**12 · The deck.** The smear is in the downloaded model, not the decimation (the raw model shows it from the seat):
strips of the floor planking along the centre line, where it steps up toward the stern, have UVs collapsed in one
direction. `dhow.py` finds faces whose weaker UV direction is under a fifth of the part's usual (the planks are mapped
with some stretch everywhere, by design), gathers them into 581 islands and projects each flat on its own plane at
the part's texel density, grain along the boat, where it already sat in the texture. UVs only.

**13 · The kanji.** The collar band is plain black-indigo with its stitching (`boatman-collar.png`); the texture in
the model is untouched.

Checks: smoke test passes (route and lap); `steer.mjs` passes (bumps on the banks and the first sandbar, worst 27 mm
into the 0.35 m clearance; sail 0.41 to 5.19 m/s); `npm run build` passes. Credits: the two scans, the sand and the
two muds added to `CREDITS.md`, each creator as shown on its page.

Perf (Low Power Mode off; @2×):

| Stretch | p50 / p95 | scale | calls | triangles |
| --- | --- | --- | --- | --- |
| z −100 Amu | 33.4 / 50.0 | 0.68 | 972 | 9.8 M |
| z −400 Manda | 32.4 / 35.0 | 0.53 | 946 | 10.7 M |
| z −900 creek | 18.1 / 34.5 | 0.50 | 804 | 10.8 M |
| z −1300 reach | 17.4 / 34.2 | 0.50 | 766 | 9.0 M |
| z −2250 open | 16.7 / 18.2 | 0.55 | 546 | 7.8 M |

Faster than step 7a in the creek and the reach (24.5 → 18.1 and 22.4 → 17.4 ms: the grass and flowers are gone) and a
little at Amu and Manda, which now sit on the 33 ms line, not under it. Draw calls rose by about 270 (four species of
card per bin); merging the card kinds into one atlas per bin would win them back.
