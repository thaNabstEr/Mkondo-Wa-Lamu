// Packs the two dhow tiers built by dhow.py into the game, the way Sakura packs its boat (pipeline/node/boat_ktx.sh):
//   quick tier  public/assets/models/dhow.glb     1K ETC1S colour, meshopt   (the first frame)
//   full tier   public/assets/models/hi/dhow.glb  UASTC colour at the source's own size, meshopt (streamed in after)
// Before compressing, the materials get what the download left out: the eye is cut out (alpha mask), painted boards
// are a little glossier than bare wood, iron is partly metallic, nothing else is.
// usage (from the repository root, with .cache/tools/env.sh sourced for toktx): node pipeline/lamu/pack-dhow.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const NODE = fileURLToPath(new URL('../node/', import.meta.url));
const req = createRequire(NODE);
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const B = fileURLToPath(new URL('../../.cache/build/', import.meta.url));
const O = fileURLToPath(new URL('../../public/assets/models/', import.meta.url));
const cli = (...a) => execFileSync('npx', ['gltf-transform', ...a], { cwd: NODE, stdio: ['ignore', 'ignore', 'inherit'] });

// roughness, metalness per material; the rest of each material is as downloaded
const SURF = {
  wood: [0.85, 0], hull_paint: [0.7, 0], spars: [0.85, 0], rope: [0.95, 0], pins: [0.8, 0], sail: [0.92, 0],
  sail_rings: [0.95, 0], iron: [0.55, 0.45], rudder_iron: [0.55, 0.45], bowboard: [0.55, 0], emblem: [0.85, 0],
};

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const tier of ['lo', 'hi']) {
  const doc = await io.read(B + `dhow_${tier}.glb`);
  for (const m of doc.getRoot().listMaterials()) {
    const s = SURF[m.getName()];
    if (!s) throw new Error(`pack-dhow: unexpected material ${m.getName()}`);
    m.setRoughnessFactor(s[0]).setMetallicFactor(s[1]);
    if (m.getName() === 'emblem') m.setAlphaMode('MASK').setAlphaCutoff(0.5).setDoubleSided(false);
    else if (m.getName() === 'bowboard') m.setAlphaMode('OPAQUE').setDoubleSided(false);
    else m.setAlphaMode('OPAQUE');
  }
  await io.write(B + `dhow_${tier}_m.glb`, doc);
}

const U = ['--level', '2', '--rdo', '--rdo-lambda', '2', '--zstd', '18'];
const MO = ['--level', 'medium', '--quantize-position', '16', '--quantize-normal', '12', '--quantize-texcoord', '14'];
// full
cli('dedup', B + 'dhow_hi_m.glb', B + 'h1.glb');
cli('uastc', B + 'h1.glb', B + 'h2.glb', ...U);
cli('meshopt', B + 'h2.glb', O + 'hi/dhow.glb', ...MO);
// quick
cli('dedup', B + 'dhow_lo_m.glb', B + 'q1.glb');
cli('etc1s', B + 'q1.glb', B + 'q2.glb', '--resize', '1024', '--quality', '200');
cli('meshopt', B + 'q2.glb', O + 'dhow.glb', ...MO);
for (const f of [O + 'dhow.glb', O + 'hi/dhow.glb']) console.log(f.split('/models/')[1], (statSync(f).size / 1e6).toFixed(2), 'MB');
