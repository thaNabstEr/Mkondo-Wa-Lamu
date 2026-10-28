// The mangrove forest. Four kinds of tree, processed by pipeline/lamu/mangrove.py:
//   red    the red mangrove (stilt roots, propagules), in three tiers: lod0 near, lod1 mid, lod2 three crossed cards
//   brug   the black mangrove, grown from the Bruguiera leaf scan through the atlas pipeline, the same three tiers
//   rhizo  red mangrove clumps from the Rhizophora field scan, cards only: the forest mass
//   light  a lighter mangrove, cards only, mixed into the ranks behind
// The bank rank (the trees standing in the water's edge, placed as 'bank') is what the boat passes close by: those
// near the camera are drawn as real geometry from pools refilled as the boat moves (lod0 within NEAR metres, lod1
// within MID), every other tree as its cards, binned along the channel so whole stretches cull at once. The water
// reflects the cards only. Each tree carries its own tint; everything sways in the shared wind.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { U, patch, WIND_GLSL } from '../core/shared.js';
import { LAYER_NOREFL, LAYER_FXREFL } from '../core/pipeline.js';
import { LEAF_VERT } from './trees.js';
import { bakeParts } from './props.js';
import { TREE_STRIDE, KINDS } from './place-trees.js';
import { Z_START } from './layout.js';

const BASE = './assets/models/mangrove/';
const FILES = Object.fromEntries(['red_lod0', 'red_lod1', 'red_lod2', 'light_lod2', 'rhizo_lod2', 'brug_lod0', 'brug_lod1',
  'brug_lod2'].map((k) => [k, k + '.glb']));
// the kinds drawn as geometry near the camera, and how many bank trees of each the near and mid pools hold
const POOLED = { red: { lod0: 90, lod1: 260 }, brug: { lod0: 30, lod1: 90 } };
const NEAR = 30, MID = 100;
// metres of channel per bin of cards: short for the bank rank (a bin near the camera hands its trees to the pools),
// long for the forest behind (it only culls)
const BIN = { bank: 40, inner: 120 };

export async function loadMangroves(onProgress) {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const out = {};
  let done = 0;
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    out[k] = bakeParts((await loader.loadAsync(BASE + f)).scene);
    onProgress && onProgress(++done / Object.keys(FILES).length);
  }));
  return out;
}

// how stiffly each part answers the wind: the crown and its cards most, the roots and trunk least
const STIFF = { bark: 0.25, twig: 0.7, leaf: 0.8, pod: 0.8, cards: 0.6 };
function treeMaterial(src, kind) {
  const m = src.clone();
  m.metalness = 0;
  // the red mangrove's bark is pale and grey; the stilt roots in the photographs are dark, brown and wet from the
  // tide (the black mangrove's bark was toned when it was grown)
  if (m.name === 'bark' && kind === 'red') m.color.setRGB(0.5, 0.41, 0.33);
  if (m.alphaTest > 0) m.alphaToCoverage = true;
  patch(m, {
    key: 'mangrove-' + m.name + (m.name === 'bark' ? '-' + kind : ''),
    snow: 0, wet: m.name === 'bark' ? 0.6 : 0.3, wrap: m.name === 'bark' ? 0 : 0.45,
    vertexHead: `#define SF_STIFF ${(STIFF[m.name] ?? 0.5).toFixed(2)}\n${WIND_GLSL}`,
    hooks: {
      vertex: LEAF_VERT,
      // the far cards: the three upright boards give way to the canopy card (the atlas's fourth quarter) as the
      // view looks more steeply down, so from the air the forest is a roof of leaves, not crossed boards
      // the canopy card's rim is soft (pipeline): its alpha is stretched so the half-way cut falls a quarter of the way
      // up the rim, and coverage dithers across the rest, so crowns thin out into their neighbours
      alpha: m.name === 'cards' ? /* glsl */ `
        {
          float down = abs(normalize(vSfWP - cameraPosition).y);
          float top = step(0.75, vMapUv.x);
          diffuseColor.a = mix(diffuseColor.a, smoothstep(0.0, 0.5, diffuseColor.a), top);
          diffuseColor.a *= mix(1.0 - smoothstep(0.55, 0.85, down), smoothstep(0.3, 0.6, down), top);
        }` : '',
    },
  });
  return m;
}

// the far cards' shadows: the upright boards give way to the canopy card as the sun climbs (sooner than for the eye:
// only a low sun casts the boards' long shadows), so the afternoon sun casts a canopy's shade, not three crossed
// boards' six-armed star
function cardDepth(m) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: 0.5 });
  d.onBeforeCompile = (sh) => {
    sh.uniforms.uSunDir = U.uSunDir;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSunDir;')
      .replace('#include <alphatest_fragment>', /* glsl */ `
        {
          float down = abs(normalize(uSunDir).y);
          float top = step(0.75, vMapUv.x);
          diffuseColor.a = mix(diffuseColor.a, smoothstep(0.0, 0.5, diffuseColor.a), top);
          diffuseColor.a *= mix(1.0 - smoothstep(0.2, 0.4, down), smoothstep(0.15, 0.35, down), top);
        }
        #include <alphatest_fragment>`);
  };
  d.customProgramCacheKey = () => 'mangrove-cards-depth';
  return d;
}

export function createMangroves(src, placed) {
  const group = new THREE.Group();
  group.name = 'mangroves';
  const mats = new Map();
  const mat = (part, kind) => {
    const k = part.mat.name + ':' + part.mat.uuid;
    if (!mats.has(k)) mats.set(k, treeMaterial(part.mat, kind));
    return mats.get(k);
  };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  const matrixOf = (a, i, out) => {
    const o = i * TREE_STRIDE;
    e.set(a[o + 5], a[o + 3], a[o + 6], 'YXZ');
    q.setFromEuler(e);
    return out.compose(ps.set(a[o], a[o + 1], a[o + 2]), q, sc.setScalar(a[o + 4]));
  };
  // the tree's tint: a little lighter or darker, warmer (yellower) or cooler (bluer) green
  const col = new THREE.Color();
  const tintOf = (a, i) => {
    const o = i * TREE_STRIDE, b = 1 + 0.13 * a[o + 8], w = a[o + 9];
    return col.setRGB(b * (1 + 0.07 * w), b * (1 + 0.02 * w), b * (1 - 0.09 * w));
  };
  const depths = new Map();
  const instanced = (part, n, name, kind) => {
    const im = new THREE.InstancedMesh(part.geo, mat(part, kind), n);
    if (part.mat.name === 'cards') {
      if (!depths.has(im.material)) depths.set(im.material, cardDepth(im.material));
      im.customDepthMaterial = depths.get(im.material);
    }
    im.name = name;
    im.castShadow = true; im.receiveShadow = true;
    im.matrixAutoUpdate = false;
    return im;
  };
  let tris = 0;

  // ---- cards, binned along the channel. A bank bin near the camera moves to the mirror only: its trees are drawn
  // as geometry by the pools
  const bankBins = [];
  const cardBins = (arr, bank) => {
    const len = bank ? BIN.bank : BIN.inner;
    const bins = new Map();
    for (let i = 0; i < arr.length / TREE_STRIDE; i++) {
      const b = Math.floor((Z_START - arr[i * TREE_STRIDE + 2]) / len);
      if (!bins.has(b)) bins.set(b, []);
      bins.get(b).push(i);
    }
    for (const [b, ids] of bins) {
      // a bin holds every kind of card, by each record's kind
      for (const [v, kind] of KINDS.entries()) {
        const mine = ids.filter((i) => arr[i * TREE_STRIDE + 7] === v);
        if (!mine.length) continue;
        for (const part of src[kind + '_lod2']) {
          const im = instanced(part, mine.length, `cards-${kind}-${b}`, kind);
          mine.forEach((id, j) => { im.setMatrixAt(j, matrixOf(arr, id, m4)); im.setColorAt(j, tintOf(arr, id)); });
          im.computeBoundingSphere();
          group.add(im);
          tris += mine.length * part.geo.index.count / 3;
          if (bank) bankBins.push({ im, z0: Z_START - b * len, z1: Z_START - (b + 1) * len, ids: mine, arr });
        }
      }
    }
  };
  cardBins(placed.bank, true);
  cardBins(placed.inner, false);

  // ---- the bank rank near the camera, as geometry: a near and a mid pool per kind
  const pools = {};
  for (const [kind, size] of Object.entries(POOLED)) {
    pools[kind] = {};
    for (const tier of ['lod0', 'lod1']) {
      pools[kind][tier] = src[kind + '_' + tier].map((part) => {
        const im = instanced(part, size[tier], `bank-${kind}-${tier}`, kind);
        im.setColorAt(0, col.setRGB(1, 1, 1));
        im.count = 0;
        im.frustumCulled = false;
        im.layers.set(LAYER_NOREFL);
        group.add(im);
        return im;
      });
    }
  }

  const last = new THREE.Vector3(1e9, 0, 0);
  const tmp = new THREE.Vector3();
  function update(camera) {
    const c = camera.position;
    if (c.distanceToSquared(last) < 9) return;
    last.copy(c);
    const n = Object.fromEntries(Object.keys(POOLED).map((k) => [k, { lod0: 0, lod1: 0 }]));
    for (const B of bankBins) {
      // distance from the camera to the bin's stretch of channel, along z
      const dz = Math.max(0, B.z1 - c.z, c.z - B.z0);
      const near = dz < MID;
      B.im.layers.set(near ? LAYER_FXREFL : 0);
      if (!near) continue;
      for (const id of B.ids) {
        const o = id * TREE_STRIDE;
        const kind = KINDS[B.arr[o + 7]];
        tmp.set(B.arr[o], B.arr[o + 1], B.arr[o + 2]);
        const d = tmp.distanceTo(c);
        const tier = d < NEAR ? 'lod0' : 'lod1';
        const k = n[kind];
        if (k[tier] >= POOLED[kind][tier]) continue;
        matrixOf(B.arr, id, m4);
        tintOf(B.arr, id);
        for (const im of pools[kind][tier]) { im.setMatrixAt(k[tier], m4); im.setColorAt(k[tier], col); }
        k[tier]++;
      }
    }
    for (const kind of Object.keys(POOLED)) {
      for (const tier of ['lod0', 'lod1']) {
        for (const im of pools[kind][tier]) {
          im.count = n[kind][tier]; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true;
        }
      }
    }
    group.userData.stats.pool = n;
  }
  group.userData.update = update;
  group.userData.stats = { bank: placed.bank.length / TREE_STRIDE, inner: placed.inner.length / TREE_STRIDE, cardTris: tris };
  return group;
}
