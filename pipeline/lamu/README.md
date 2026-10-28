# Mkondo wa Lamu asset pipeline

Every downloaded asset is processed here before it goes into the game; no raw download ships. The scripts read from
`Context/3D Assets/` and `Context/Image References/` (kept out of the repository) and write to `public/assets/` and,
for measured data the code needs, `src/world/`. Intermediate files go to `.cache/build/`.

Tools: Blender 5.2 (headless), Node 20+ with `npm install` in `pipeline/node`, and KTX-Software and libwebp in
`.cache/tools/` (`source .cache/tools/env.sh`).

| Script | What it does |
| --- | --- |
| `inspect.py` | Lists a model's parts, triangles, bounds and materials |
| `render.py` | Renders a model from fixed views, for before/after comparisons |
| `textures.mjs` | The Lamu eye cut to its ring; the bow board drawn in code |
| `dhow.py` | The dhow: turned into the game's frame, scaled, parts named, eye and bow boards fitted, the rudder head and tiller added (the rudder its own node), the decks' smeared UV strips re-projected, two tiers decimated; writes `src/world/hull.js` |
| `pack-dhow.mjs` | Material fixes, KTX2 textures and meshopt geometry, into `public/assets/models/` |
| `build-dhow.sh` | All of the dhow's steps in order |
| `bruguiera_sprays.py` | The black mangrove's leaf sprays: its scanned leaves and flowers laid out on twigs and rendered into atlas cells with Sakura's `pipeline/veg/atlaslib.py` |
| `bruguiera_tree.py` | A black mangrove grown in code (trunk, buttresses, knee roots, tiered limbs) carrying those sprays |
| `mangrove.py` | One mangrove species into its tiers: near and mid geometry (the stilt roots kept finer than the crown) and far cards from four sides, the canopy view soft-edged |
| `pack-mangrove.mjs` | Every species' tiers: alpha masks, WebP, meshopt, into `public/assets/models/mangrove/` |
| `build-mangroves.sh` | All of the trees' steps in order (red, light, the Rhizophora clump, the Bruguiera) |
| `ground.sh` | The TextureCan muds into the game's texture format |
