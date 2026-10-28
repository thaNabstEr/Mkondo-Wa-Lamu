// Packs the mangrove tiers built by mangrove.py into public/assets/models/mangrove/: the cut-out materials become
// alpha masks (leaves, twig sprays and propagules show both faces; the far cards carry their own back faces), the
// bark is opaque and matte, textures go to WebP (as Sakura's plant atlases) and geometry to meshopt.
// usage (from the repository root): node pipeline/lamu/pack-mangrove.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';

const NODE = fileURLToPath(new URL('../node/', import.meta.url));
const req = createRequire(NODE);
const { NodeIO } = req('@gltf-transform/core');
const { ALL_EXTENSIONS } = req('@gltf-transform/extensions');
const B = fileURLToPath(new URL('../../.cache/build/', import.meta.url));
const O = fileURLToPath(new URL('../../public/assets/models/mangrove/', import.meta.url));
mkdirSync(O, { recursive: true });
const cli = (...a) => execFileSync('npx', ['gltf-transform', ...a], { cwd: NODE, stdio: ['ignore', 'ignore', 'inherit'] });

// alpha mode, double-sided, roughness
const SURF = {
  bark: ['OPAQUE', false, 0.9], leaf: ['MASK', true, 0.75], twig: ['MASK', true, 0.85], pod: ['MASK', true, 0.7],
  cards: ['MASK', false, 0.85],
};
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
// every tier of every species mangrove.py builds (red, light, rhizo, brug)
const TIERS = ['red_lod0', 'red_lod1', 'red_lod2', 'light_lod2', 'rhizo_lod2', 'brug_lod0', 'brug_lod1', 'brug_lod2'];
for (const name of TIERS) {
  const doc = await io.read(B + `mangrove_${name}.glb`);
  for (const m of doc.getRoot().listMaterials()) {
    const s = SURF[m.getName()];
    if (!s) throw new Error(`pack-mangrove: unexpected material ${m.getName()} in ${name}`);
    m.setAlphaMode(s[0]).setDoubleSided(s[1]).setRoughnessFactor(s[2]).setMetallicFactor(0);
    if (s[0] === 'MASK') m.setAlphaCutoff(0.5);
  }
  await io.write(B + `m_${name}.glb`, doc);
  cli('dedup', B + `m_${name}.glb`, B + `m1_${name}.glb`);
  cli('webp', B + `m1_${name}.glb`, B + `m2_${name}.glb`, '--quality', '88');
  cli('meshopt', B + `m2_${name}.glb`, O + `${name}.glb`, '--level', 'medium', '--quantize-position', '16', '--quantize-normal', '10', '--quantize-texcoord', '14');
  console.log(`mangrove/${name}.glb`, (statSync(O + `${name}.glb`).size / 1e6).toFixed(2), 'MB');
}
