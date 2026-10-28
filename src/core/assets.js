import * as THREE from 'three';

const BASE = './assets/tex/';
export const TEX_LIST = [
  'forrest_ground_01', 'leafy_grass', 'rock_face', 'lichen_rock', 'snow_02', 'forest_leaves_02', 'turf',
  'damp_beach_sand_02', 'mud_puddles', 'mud_leaves',
];
// foliage atlases with alpha, clamped (one file each, no normal map). None at present: the bank flowers are gone.
export const ATLAS_LIST = [];

export async function loadTextures(renderer, onProgress) {
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const out = {};
  const jobs = [];
  let done = 0;
  const total = TEX_LIST.length * 2 + ATLAS_LIST.length;
  for (const id of TEX_LIST) {
    for (const m of ['c', 'n']) {
      jobs.push(
        loader.loadAsync(`${BASE}${id}_${m}.webp`).then((t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.anisotropy = aniso;
          t.colorSpace = m === 'c' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          t.generateMipmaps = true;
          t.minFilter = THREE.LinearMipmapLinearFilter;
          out[`${id}_${m}`] = t;
          done++;
          onProgress && onProgress(done / total);
        })
      );
    }
  }
  for (const id of ATLAS_LIST) {
    jobs.push(
      loader.loadAsync(`${BASE}${id}.webp`).then((t) => {
        t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
        t.anisotropy = aniso;
        t.colorSpace = id.endsWith('_n') ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        out[id] = t;
        done++;
        onProgress && onProgress(done / total);
      })
    );
  }
  await Promise.all(jobs);
  return out;
}
