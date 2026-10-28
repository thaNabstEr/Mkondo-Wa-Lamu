# Credits

Mkondo wa Lamu is built on **[Sakura Fantasy](https://github.com/billpwchan/sakura-fantasy)** by Bill Chan (MIT): its
engine, water, light, weather, camera, interface and much else. The source code is MIT-licensed (see
[LICENSE](LICENSE)). The assets in `public/assets` were made for Sakura Fantasy or for Mkondo wa Lamu, or come from
the sources below, each under its own licence. Nothing is used under a non-commercial or no-derivatives licence.

## Mkondo wa Lamu

Each downloaded asset is processed by a script in `pipeline/lamu/` before it ships; the scripts say what was changed.

| File in the game | Source | Creator (as shown on its page) | Licence | Downloaded | Notes |
| --- | --- | --- | --- | --- | --- |
| `models/dhow.glb`, `models/hi/dhow.glb` | [Dhow](https://sketchfab.com/3d-models/dhow-5217bd7dffdf4928823e5e489e40617c) (Sketchfab) | gogiart (@agt14032013) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-27 (file date) | Turned, scaled ×1.1, decimated into two tiers (`pipeline/lamu/dhow.py`); the sail's eye and the bow boards are added |
| `models/mangrove/red_lod*.glb` | [red-mangrove-tree](https://sketchfab.com/3d-models/red-mangrove-tree-e806105d83bc440499495e62bb010f7a) (Sketchfab) | SAVIA_Colombia (@Minambiente_Col) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-27 (file date) | Scaled to a 7.4 m crown, cut-out leaves, thinned into near and mid versions and far cards rendered from it (`pipeline/lamu/mangrove.py`); bark toned darker |
| `models/mangrove/light_lod2.glb` | [Mangrove Tree](https://sketchfab.com/3d-models/mangrove-tree-5d4542431caa46f0b6f1feb089fc19dd) (Sketchfab) | Nice2meetU2 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 2026-10-27 (file date) | Far cards rendered from it; its leaves cut out by keying their colour (`pipeline/lamu/mangrove.py`) |
| `models/mangrove/rhizo_lod2.glb` | [CC0 ヤエヤマヒルギ Red Mangrove, Rhizophora mucronata](https://sketchfab.com/3d-models/cc0-red-mangrove-rhizophora-mucronata-5658cc5123b14393abbeb65174b0f85a) (Sketchfab) | ffish.asia / floraZia.com (@ffishAsia-and-floraZia) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-27 (file date) | A field scan of a clump: far cards rendered from it, its mud cut away and grey patches greened (`pipeline/lamu/mangrove.py`) |
| `models/mangrove/brug_lod*.glb` | [CC0 オヒルギ Black Mangrove, Bruguiera gymnorhiza](https://sketchfab.com/3d-models/cc0-black-mangrove-bruguiera-gymnorhiza-e075db44fc4d4c2c8a1598728803d744) (Sketchfab) | ffish.asia / floraZia.com (@ffishAsia-and-floraZia) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 2026-10-27 (file date) | Its scanned leaves and flowers rendered into spray cells (`pipeline/lamu/bruguiera_sprays.py`), carried on a tree grown in code (`bruguiera_tree.py`) with the red mangrove's bark image, then tiered like the others |
| `tex/damp_beach_sand_02_*.webp` | [Damp Beach Sand 02](https://polyhaven.com/a/damp_beach_sand_02) (Poly Haven) | Dimitrios Savva | [CC0](https://polyhaven.com/license) | 2026-10-28 | 1K colour and normal (`scripts/fetch-assets.mjs`); lightened in the terrain shader to pale coral sand |
| `tex/mud_puddles_*.webp` | Muddy ground with puddles, `ground_0034` ([TextureCan](https://www.texturecan.com/)) | TextureCan | [CC0](https://www.texturecan.com/terms/) (no attribution required) | 2026-10-27 (file date) | 1K colour and OpenGL normal (`pipeline/lamu/ground.sh`): the banks |
| `tex/mud_leaves_*.webp` | Wet muddy ground with fallen leaves, `ground_0005` ([TextureCan](https://www.texturecan.com/)) | TextureCan | [CC0](https://www.texturecan.com/terms/) (no attribution required) | 2026-10-27 (file date) | 1K colour and OpenGL normal (`pipeline/lamu/ground.sh`): the forest floor |

Made for Mkondo wa Lamu:
- The Lamu eye on the sail: the project's own artwork (`emblem.png`).
- The bow boards: an original design in the Lamu manner, drawn in code (`pipeline/lamu/textures.mjs`).
- The dhow's rudder head and tiller: a fitting added to the downloaded model, which has none (`pipeline/lamu/dhow.py`).

## Sakura Fantasy

The assets Mkondo wa Lamu keeps from Sakura Fantasy (the boatman, textures, props, sounds) and their sources:

### Plants: CC0

Every tree, shrub, flower and grass atlas was rendered from photogrammetry scans by
**[ffish.asia / floraZia](https://sketchfab.com/ffishAsia-and-floraZia)**, released under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The scans used were:
- Yoshino cherry blossom;
- Japanese zelkova (sakura leaves);
- Japanese maple;
- konara oak;
- Japanese black pine;
- Japanese cedar;
- Oomurasaki and Hirado azalea;
- golden bamboo;
- common reed;
- Chinese silver grass;
- dandelion;
- Japanese buttercup;
- Manchurian violet;
- white clover;
- red spider lily.

[`pipeline/README.md`](pipeline/README.md) links each scan.

### Textures and props: CC0

- **[Poly Haven](https://polyhaven.com)**, [CC0](https://polyhaven.com/license).
  - Textures: ground, rock, pebbles, snow, bark, planks, stone wall, roof tiles, reed roof, plaster.
  - Scanned models: mossy rocks, boulders, ferns, shrubs, stumps, a fallen trunk, and the grass used in the
    ground-cover atlas.
- **[ambientCG](https://ambientcg.com)**, [CC0](https://docs.ambientcg.com/license/): wicker, rope, thatch and paper
  textures on the boat.

### Statues: CC BY 4.0

Both statues were simplified and regraded:
- [Komainu Statue](https://sketchfab.com/3d-models/komainu-statue-a5d4791ae95d4a9d9becedab6d2c7fc2) by
  [Zgon](https://sketchfab.com/Z-gon), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Downloaded under that
  licence on 2026-10-02; the model's download has since been switched off on Sketchfab.
- [Jizo statue in Kyoto](https://sketchfab.com/3d-models/jizo-statue-in-kyoto-mtsu-animation-08f07b04c4384f8fa9b75e8203d9f26f)
  by [MTSU Animation Virtual Production](https://sketchfab.com/fusion),
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

### People

The boatman and the passenger are built on bodies from **[MPFB 2 / MakeHuman](https://static.makehumancommunity.org/mpfb.html)**.
Their assets are [CC0](https://static.makehumancommunity.org/about/license.html). Their clothes, hair and the wagasa
were made for this project.

### Boat, buildings, water, sky, effects

These were made for this project: the boat is built by `pipeline/boat/build.py`, and everything else is generated in
code.

### Sound

Every recording below was trimmed, filtered and levelled by `pipeline/audio/build.py`, which also fetches them.
The river, wind, rain, oar, fireworks, thunder and higurashi are synthesised in code.

Recordings that require attribution:

| Sound | Source | Author | Licence |
|---|---|---|---|
| Bonshō, Zōjō-ji, Tokyo | [Freesound 843521](https://freesound.org/s/843521/) | Echograin | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Bonshō, Raigō-in, Ōhara, Kyoto | [Freesound 462757](https://freesound.org/s/462757/) | LG | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Keisu (temple bowl) | [Freesound 367128](https://freesound.org/s/367128/) | milivolt | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Fūrin (wind chime) | [Freesound 212818](https://freesound.org/s/212818/) | Taira Komori | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Sutra chant | [Freesound 686627](https://freesound.org/s/686627/) | calebjay | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| Suzumushi (bell cricket), Kami, Hyōgo | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Suzumushi_06z3286.ogg) | Cory | [CC BY 2.1 JP](https://creativecommons.org/licenses/by/2.1/jp/) |

Public domain and CC0, credited with thanks:
- **Instruments.**
  - Koto: built from the [VCSL](https://github.com/sgossner/VCSL) Đàn tranh samples by Sam Gossner (CC0). The
    Đàn tranh is the koto's cousin; each pluck is re-voiced towards the koto's measured spectrum and decay.
  - Shō: [Vrymaa](https://freesound.org/s/792664/).
  - Shakuhachi: a single A4,
    [via Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Shakuhachi-flute-440Hz.ogg).
  - Suzu (shrine bells): [Vrymaa](https://freesound.org/s/739753/).
  - Mokugyo: [jonopodmore](https://freesound.org/s/607215/).
  - Fūrin: [ayustat2001](https://freesound.org/s/501168/).
- **Kyoto gardens**, recorded by Fg2 on Wikimedia Commons:
  - [suikinkutsu](https://commons.wikimedia.org/wiki/File:Suikinkutsu-LS100112.ogg) (Enkō-ji);
  - [shishi-odoshi](https://commons.wikimedia.org/wiki/File:Shishiodoshi-LS100103.ogg) (Shisen-dō).
- **Uguisu** (bush warbler):
  - [warukunai](https://freesound.org/s/524526/);
  - [Fg2](https://commons.wikimedia.org/wiki/File:SND_4458a.ogg).
- **Field recordings.**
  - Cicadas at Hie Jinja: [markystar](https://freesound.org/s/79086/).
  - Autumn insects: [RutgerMuller](https://freesound.org/s/365257/).
  - A bamboo grove: [tomasloos](https://freesound.org/s/843520/).
  - Gagaku at a shrine: [gaijinbuzz](https://freesound.org/s/680565/).
  - A summer festival and rice-field frogs: [macdaddyno1](https://freesound.org/s/352605/),
    [macdaddyno1](https://freesound.org/s/396491/).

### Words

The haiku are classical and in the public domain:
- Bashō, Buson, Issa, Shiki and others;
- the English renderings are our own.

### Fonts

The interface fonts are served by Google Fonts under the [SIL Open Font License](https://openfontlicense.org):
- Shippori Mincho B1;
- Cormorant Garamond.

### Inspiration

Meng To's *Sakura River Valley* (2026) inspired the project. None of its code or assets are used.
