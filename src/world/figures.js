// The boatman: sculpted, dressed and posed in Blender (pipeline/figs), skinned so he can turn his head and move
// his arms and legs. His fabrics are drawn here. Parts that share a material carry an id in vertex colour.
// (Sakura's passenger and her wagasa are not aboard the dhow.)
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { patch, ktx2 } from '../core/shared.js';

const URL = './assets/models/figures/';
const FILES = { boatman: 'boatman.glb' };

export async function loadFigures(renderer, onProgress) {
  const loader = new GLTFLoader().setKTX2Loader(ktx2(renderer)).setMeshoptDecoder(MeshoptDecoder);
  const names = Object.keys(FILES);
  const prog = names.map(() => 0);
  const out = await Promise.all(names.map((n, i) => loader.loadAsync(URL + FILES[n], (e) => {
    if (!onProgress || !e.total) return;
    prog[i] = e.loaded / e.total;
    onProgress(prog.reduce((a, b) => a + b, 0) / names.length);
  })));
  return Object.fromEntries(names.map((n, i) => [n, out[i].scene]));
}

// ---------------------------------------------------------------- shared shader pieces
// positions arrive quantised to the mesh's own unit box (the scale is folded into the skin's inverse binds); uDeq
// maps them back to the figure's frame in metres.
const VERT = /* glsl */ `attribute vec4 pid; uniform mat4 uDeq; varying vec4 vPid; varying vec3 vObj; varying vec3 vObjN; varying vec2 vFUv;`;
const FRAG = /* glsl */ `
varying vec4 vPid; varying vec3 vObj; varying vec3 vObjN; varying vec2 vFUv;
float fgH = 0.0;        // bump height, in metres of relief
float fgRough = -1.0, fgMetal = -1.0;
float fgBumpK = 1.0;
// screen-space bump from a height field (as three's perturbNormalArb)
vec3 fgBump(vec3 n, float h) {
  vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g);
}
float fgAA(float d) { float w = max(fwidth(d), 1e-6); return clamp(0.5 - d / w, 0.0, 1.0); }
float fgAAw(float d, float w) { return clamp(0.5 - d / w, 0.0, 1.0); }
float fgFade(float scale) { return 1.0 - smoothstep(0.25, 0.8, fwidth(scale)); }
bool fgId(float c) { return abs(vPid.x - c) < 0.03; }
`;
const VHOOKS = { vertex: 'vPid = pid; vObj = (uDeq * vec4(position, 1.0)).xyz; vFUv = uv;', beginNormal: 'vObjN = objectNormal;' };
const NORMAL_HOOK = /* glsl */ `
  if (fgRough >= 0.0) roughnessFactor = fgRough;
  if (fgMetal >= 0.0) metalnessFactor = fgMetal;
  normal = fgBump(normal, fgH * fgBumpK);`;

function figMat(m, key, o) {
  m.userData.uDeq = { value: new THREE.Matrix4() };
  return patch(m, {
    key: 'fig-' + key,
    snow: o.snow ?? 0.5,
    wet: o.wet ?? 0.6,
    vertexHead: VERT,
    fragHead: FRAG + (o.head || ''),
    uniforms: { uDeq: m.userData.uDeq, ...o.uniforms },
    hooks: { ...VHOOKS, map: o.map, normal: NORMAL_HOOK + (o.normal || ''), alpha: o.alpha, light: o.light },
  });
}

// ---------------------------------------------------------------- furisode: bokashi ground, sakura, gold mist
const SAKURA = /* glsl */ `
// a five-petalled sakura of radius r centred on q, each petal notched at its tip; signed distance in r units
float fgPetals(vec2 q, float r, float rot) {
  float a = atan(q.y, q.x) + rot;
  float seg = mod(a + 0.6283185, 1.2566371) - 0.6283185;
  float R = r * pow(max(cos(seg * 2.5), 0.0), 0.3);
  R -= r * 0.2 * max(0.0, 1.0 - abs(seg) / 0.15);
  return length(q) - R;
}
// one blossom per cell; dens is the chance a cell holds one. Writes colour, gold, relief.
void fgBlossoms(vec2 p, float cell, float dens, float seed, inout vec3 col, inout float gold, inout float h) {
  float px = max(length(fwidth(p)), 1e-6);
  vec2 g = p / cell + seed;
  vec2 id = floor(g), f = fract(g) - 0.5;
  float r1 = sfHash12(id), r2 = sfHash12(id + 17.31), r3 = sfHash12(id + 41.7), r4 = sfHash12(id + 7.13);
  if (r1 > dens) return;
  float rad = mix(0.27, 0.4, r2);
  vec2 c = (vec2(r3, r4) - 0.5) * (0.92 - 2.0 * rad);
  vec2 q = f - c;
  float d = fgPetals(q, rad, r2 * 6.283) * cell;
  float inside = fgAAw(d, px);
  if (inside <= 0.0 && d > 0.004) return;
  // petal colour: white, blush or deep pink, paler toward the centre as dyed petals are
  float k = fract(r1 * 7.3 + r3);
  vec3 pc = k < 0.45 ? vec3(0.86, 0.83, 0.8) : k < 0.8 ? vec3(0.92, 0.58, 0.64) : vec3(0.85, 0.36, 0.48);
  float rr = length(q) / rad;
  pc = mix(pc * vec3(1.0, 0.85, 0.88), pc, smoothstep(0.0, 0.7, rr));
  // the eye: a deep red centre and five gold stamens
  float eye = fgAAw(length(q) * cell - rad * cell * 0.17, px);
  pc = mix(pc, vec3(0.45, 0.02, 0.08), eye);
  float a = atan(q.y, q.x) + r2 * 6.283 + 0.6283;
  float st = abs(mod(a + 0.6283, 1.2566) - 0.6283) * rr;
  float stam = fgAAw(st * cell - 0.0007, px) * step(0.12, rr) * step(rr, 0.42);
  col = mix(col, pc, inside);
  // a fine gold outline on most of them (kinsai), embroidered
  float edge = fgAAw(abs(d) - 0.0007, px) * step(0.35, r4);
  gold = max(gold, max(edge, stam * inside));
  h += (smoothstep(0.003, -0.002, d) * 0.6 + edge * 0.3) * 0.0004;
}
// suyari-gasumi: long gold mist bands with rounded, tapering ends, filled with gold dust (surihaku) and edged
void fgMist(vec2 p, float y, inout vec3 col, inout float gold, inout float h) {
  float row = floor(y / 0.16);
  float on = step(sfHash12(vec2(row, 3.7)), 0.6) * smoothstep(0.62, 0.48, y) * step(0.05, y);
  if (on <= 0.0) return;
  float y0 = row * 0.16 + 0.08 + (sfHash12(vec2(row, 9.1)) - 0.5) * 0.05;
  float n = sfNoise(vec2(p.x * 2.6 + row * 13.0, row * 1.7));
  float m = smoothstep(0.5, 0.62, n);
  float hh = 0.024 * sqrt(m);
  float d = abs(p.y - y0 + 0.006 * sin(p.x * 9.0 + row)) - hh;
  float inside = fgAA(d) * step(0.002, hh);
  if (inside <= 0.0 && d > 0.003) return;
  float dust = 0.55 + 0.45 * step(0.45, sfNoise(p * 420.0));
  float edge = fgAA(abs(d + 0.0012) - 0.0009);
  col = mix(col, col * 0.85, inside);
  gold = max(gold, max(inside * dust * 0.85, edge) * on);
  h += (inside * 0.0001 + edge * 0.00025) * on;
}
vec3 fgKimono(vec2 p, float y, out float gold, out float h) {
  // bokashi: pale sakura at the shoulders through rose to a deep plum at the hem and the sleeve ends, the boundary
  // clouded as dye bleeds
  float cl = (sfNoise(p * 3.2) - 0.5) * 0.14 + (sfNoise(p * 9.0) - 0.5) * 0.04;
  float t = smoothstep(0.04, 0.66, y + cl);
  vec3 col = mix(vec3(0.1, 0.012, 0.075), vec3(0.48, 0.13, 0.27), smoothstep(0.0, 0.5, t));
  col = mix(col, vec3(0.86, 0.6, 0.64), smoothstep(0.45, 1.0, t));
  gold = 0.0; h = 0.0;
  fgMist(p, y, col, gold, h);
  // the blossoms gather at the hem and the sleeve ends and thin out toward the shoulders, in drifts
  float drift = sfNoise(p * 1.8 + 4.0);
  float dens = clamp(mix(0.9, 0.08, smoothstep(0.05, 0.64, y)) + (drift - 0.5) * 0.8, 0.0, 0.92);
  fgBlossoms(p, 0.14, dens, 0.0, col, gold, h);
  fgBlossoms(p, 0.075, dens * 0.75, 0.37, col, gold, h);
  return col;
}
// crepe (chirimen): a fine crinkle, faded out where the pixel is larger than it
float fgCrepe(vec2 p) {
  float s = sfNoise(p * vec2(1500.0, 900.0)) * 0.6 + sfNoise(p * vec2(700.0, 2600.0)) * 0.4;
  return s * 0.00006 * (1.0 - smoothstep(0.0006, 0.0018, fwidth(p.x) + fwidth(p.y)));
}
`;

// ---------------------------------------------------------------- hair: lacquer-black, combed toward the mage
const HAIR_LIGHT = /* glsl */ `
      {
        // Kajiya-Kay: two shifted lobes along the strand (dp/du from the screen derivatives of the flow uv)
        vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
        vec2 dux = dFdx(vFUv), duy = dFdy(vFUv);
        float det = dux.x * duy.y - dux.y * duy.x;
        vec3 T = (dpx * duy.y - dpy * dux.y) * sign(det);
        T = normalize(T - normal * dot(T, normal) + 1e-6);
        vec3 L = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        vec3 Vd = normalize(vViewPosition);
        vec3 H = normalize(L + Vd);
        float sh = (sfNoise(vec2(vFUv.y * 140.0, vFUv.x * 3.0)) - 0.5) * 0.35;
        vec3 T1 = normalize(T + normal * (0.1 + sh));
        vec3 T2 = normalize(T + normal * (-0.15 + sh));
        float a1 = dot(T1, H), a2 = dot(T2, H);
        float s1 = pow(sqrt(max(1.0 - a1 * a1, 0.0)), 160.0);
        float s2 = pow(sqrt(max(1.0 - a2 * a2, 0.0)), 36.0);
        float nl = smoothstep(-0.1, 0.4, dot(normal, L));
        reflectedLight.directSpecular += uSunCol * sfShadow * nl * (s1 * 0.09 + s2 * 0.035 * vec3(0.7, 0.55, 0.45));
        // the sky in the pomade
        float f = pow(1.0 - max(dot(normal, Vd), 0.0), 4.0);
        reflectedLight.indirectSpecular += uSkyHor * f * 0.12 * (0.6 + 0.8 * s1);
      }`;

// ---------------------------------------------------------------- skin: the shaved line under the hair, and warmth
function skinMaterial(src, beard = false) {
  const m = new THREE.MeshPhysicalMaterial({ map: src.map, roughness: 0.55, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.7, 0.6) });
  return figMat(m, beard ? 'skin-beard' : 'skin', {
    snow: 0.1,
    wet: 0.3,
    map: /* glsl */ `
      {
        // under the hairline the scalp shows a cool shadow of roots
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.45, 0.45, 0.5), vPid.x * 0.8);
        ${beard ? `// a day's stubble on the jaw and lip: a blue-grey shadow, speckled where the pixel is fine enough
        float sn = mix(0.5, sfNoise(vObj.xy * 2600.0 + vObj.z * 1700.0), fgFade(vObj.x * 2600.0));
        diffuseColor.rgb *= 1.0 - vPid.y * (0.18 + 0.3 * sn);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.82, 0.88, 1.0), vPid.y * 0.6);` : ''}
      }`,
    light: /* glsl */ `
      {
        // light scattered under the skin: a red wrap past the terminator
        vec3 L = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        float w = max(0.0, (dot(normal, L) + 0.35) / 1.35) - max(0.0, dot(normal, L));
        reflectedLight.directDiffuse += uSunCol * sfShadow * w * diffuseColor.rgb * vec3(0.5, 0.18, 0.1) * 0.25;
      }`,
  });
}

// ---------------------------------------------------------------- the sendo: indigo cotton, sedge and straw
// figure frame: x his left, y up, z forward; the hanten's hem at 0.70, the obi from 0.832 to 0.92
const MAN = /* glsl */ `
// aizome from the deep vat to sun-faded
vec3 manAi(float k) { return mix(vec3(0.0095, 0.019, 0.058), vec3(0.034, 0.072, 0.17), k); }
const vec3 MAN_WHITE = vec3(0.6, 0.59, 0.54);
// plain-woven cotton with slubs, gone where a pixel covers many threads
float manWeave(vec2 p) {
  vec2 q = p * 1400.0;
  float k = 1.0 - smoothstep(0.4, 1.2, fwidth(q.x) + fwidth(q.y));
  return (sin(q.x) * sin(q.y) * 0.5 + (sfNoise(p * vec2(30.0, 700.0)) - 0.5) * 0.7) * k;
}
// maru ni sakura, dyed out of the indigo on the back: a ring round a five-petalled blossom, its centre left blue
// with white stamens; the resist bleeds a little at every edge
float manMon(vec2 q) {
  float px = max(length(fwidth(q)), 1e-6);
  q += (vec2(sfNoise(q * 260.0), sfNoise(q * 260.0 + 7.1)) - 0.5) * 0.0014;
  float r = length(q);
  float ring = fgAAw(abs(r - 0.103) - 0.0105, px);
  float d = fgPetals(q, 0.083, -1.5707963);
  float a = atan(q.y, q.x) - 1.5707963;
  float seg = mod(a + 0.6283185, 1.2566371) - 0.6283185;
  float sep = fgAAw((0.6283185 - abs(seg)) * r - 0.0014, px) * step(0.02, r);
  float centre = fgAAw(r - 0.021, px);
  float stam = fgAAw(abs(seg) * r - 0.001, px) * smoothstep(0.004, 0.006, r) * step(r, 0.0165);
  float tips = fgAAw(length(vec2(r - 0.0165, seg * r)) - 0.002, px);
  float w = fgAAw(d, px) * (1.0 - sep);
  w = mix(w, max(stam, tips), centre);
  return max(ring, w);
}
// koshigara: a band round the hips below the obi, yoshiwara-tsunagi links between two white lines
float manKoshi(vec3 P) {
  float px = max(length(fwidth(P)), 1e-6) * 1.2;
  float th = atan(P.x, P.z) / 6.2831853 * 26.0;
  float y = P.y - 0.752;
  float l = 0.0;
  for (int k = -1; k <= 1; k++) {
    vec2 c = abs(vec2((fract(th) - 0.5 - float(k)) * 0.041 / 0.027, y / 0.021));
    float d = (pow(pow(c.x, 1.6) + pow(c.y, 1.6), 1.0 / 1.6) - 1.0) * 0.022;
    l = max(l, fgAAw(abs(d) - 0.0022, px));
  }
  float lines = max(fgAAw(abs(P.y - 0.709) - 0.0034, px), fgAAw(abs(P.y - 0.795) - 0.0026, px));
  return max(l * step(abs(y), 0.03), lines);
}
`;

function manClothMaterial(src) {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.86, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.3, 0.38, 0.55), side: THREE.DoubleSide });
  return figMat(m, 'man-cloth', {
    wet: 0.85,
    head: SAKURA + MAN,
    map: /* glsl */ `
      {
        vec3 P = vObj;
        vec3 col; float rough = 0.86, metal = 0.0;
        float wv = manWeave(vec2(P.x + P.z, P.y));
        fgH = wv * 0.00005;
        if (fgId(0.05) || fgId(0.1)) {
          // hanten and sleeves: sun-faded over the shoulders, uneven from the vat
          float fade = 0.28 * smoothstep(0.95, 1.4, P.y) + 0.32 * (sfNoise(P.xy * 7.0 + P.z * 5.0) - 0.35) + 0.12 * sfNoise(P.yz * 31.0);
          col = manAi(clamp(fade, 0.0, 1.0));
          if (fgId(0.05)) {
            float w = 0.0;
            if (P.z < 0.0) w = manMon(vec2(-P.x, P.y - 1.085)) * smoothstep(0.15, -0.35, normalize(vObjN).z);
            if (P.y < 0.83) w = max(w, manKoshi(P));
            col = mix(col, MAN_WHITE * (0.9 + 0.12 * sfNoise(P.xy * 90.0)) * vec3(0.97, 0.98, 1.0), w);
            // gathered into the obi: folds fanning out above and below it
            float th = atan(P.x, P.z);
            float k = smoothstep(0.09, 0.0, P.y - 0.92) * step(0.905, P.y) + smoothstep(0.08, 0.0, 0.832 - P.y) * step(P.y, 0.845);
            fgH += sin(th * 34.0 + sfNoise(vec2(th * 6.0, 1.0)) * 4.0) * 0.0014 * k;
          }
          if (!gl_FrontFacing) col = vec3(0.006, 0.01, 0.028);
        } else if (fgId(0.2)) {
          // the eri: plain black-indigo with its stitching. (Sakura dyed a shop's name down it in kanji; on the Lamu
          // coast it is left blank until he is dressed as a nahodha.)
          float u = vFUv.x, v = vFUv.y;
          col = vec3(0.006, 0.0075, 0.013);
          float st = smoothstep(0.012, 0.0, abs(abs(v - 0.5) - 0.42)) * step(0.4, fract(u / 0.004));
          col = mix(col, vec3(0.05, 0.05, 0.06), st * 0.6);
          rough = 0.62;
          fgH = st * 0.00012 + wv * 0.00003;
        } else if (fgId(0.3)) {
          // momohiki: the darkest indigo, rubbed paler over the knees and seat
          float rub = sfNoise(P.xy * 9.0) * 0.5 + 0.5 * smoothstep(0.06, 0.0, abs(P.y - 0.48));
          col = mix(vec3(0.006, 0.012, 0.036), manAi(0.35), rub * 0.35);
        } else if (fgId(0.4)) {
          // tabi: navy cotton
          col = vec3(0.008, 0.012, 0.032) * (0.9 + 0.2 * sfNoise(P.xz * 80.0));
          rough = 0.9;
        } else if (fgId(0.5) || fgId(0.55) || fgId(0.58)) {
          // kaku-obi in hakata-ori: dark tea-brown, the kenjo lines and dokko down the length in pale gold
          float u = vFUv.x, v = vFUv.y;
          float px = max(fwidth(v), 1e-5);
          float lines = max(max(fgAAw(abs(v - 0.17) - 0.014, px), fgAAw(abs(v - 0.83) - 0.014, px)),
                            max(fgAAw(abs(v - 0.225) - 0.005, px), fgAAw(abs(v - 0.775) - 0.005, px)));
          float cu = u / 0.014;
          vec2 c = vec2((fract(cu) - 0.5) * 0.014, (v - 0.5) * 0.088);
          float pxm = max(length(fwidth(c)), 1e-6);
          vec2 a = abs(c);
          float motif;
          if (mod(floor(cu), 2.0) < 1.0) {
            // dokko: the vajra, waisted, its ends flared
            motif = fgAAw(max(a.x - (0.0012 + a.y * 0.36), a.y - 0.009), pxm);
          } else {
            // hanazara: a lozenge with its heart left dark
            float dd = a.x / 0.0045 + a.y / 0.0085;
            motif = fgAAw((dd - 1.0) * 0.005, pxm) * (1.0 - fgAAw((0.42 - dd) * 0.005, pxm));
          }
          float pat = max(lines * 0.8, motif * step(abs(v - 0.5), 0.12));
          col = mix(vec3(0.03, 0.017, 0.01), vec3(0.2, 0.135, 0.06), pat);
          // the hard weft rib of hakata cloth, across the band
          float rib = sin(u * 7853.98) * (1.0 - smoothstep(0.3, 1.0, fwidth(u * 7853.98)));
          fgH = rib * 0.00004 + pat * 0.00008;
          rough = mix(0.6, 0.45, pat);
          if (fgId(0.58)) col *= 0.92;
        } else if (fgId(0.65)) {
          // tenugui: mameshibori, small white rings tied out of indigo
          vec2 q = vFUv * vec2(0.26, 0.075) / 0.011;
          q.x += 0.5 * mod(floor(q.y), 2.0);
          float dd = length(fract(q) - 0.5);
          float dot_ = smoothstep(0.26, 0.2, dd) * (0.7 + 0.3 * smoothstep(0.05, 0.12, dd));
          col = mix(manAi(0.45), MAN_WHITE, dot_);
          rough = 0.9;
        } else {
          // the twisted hachimaki: white cotton, a little sweat-greyed
          col = MAN_WHITE * (0.92 + 0.1 * sfNoise(vFUv * vec2(400.0, 6.0)));
          rough = 0.9;
        }
        diffuseColor.rgb = col;
        fgRough = rough; fgMetal = metal;
      }`,
  });
}

function strawMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ roughness: 0.75, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color(0.9, 0.8, 0.5) });
  return figMat(m, 'man-straw', {
    snow: 0.9,
    wet: 0.7,
    head: SAKURA + MAN,
    map: /* glsl */ `
      {
        vec3 col; float rough = 0.75, metal = 0.0;
        if (fgId(0.1)) {
          // sugegasa: split sedge laid radially, stitched down in rings; underneath, the bamboo frame
          float u = vFUv.x, r = 1.0 - vFUv.y, rm = r * 0.24;
          float su = u * 220.0;
          float id = floor(su), f = fract(su);
          float k = sfHash12(vec2(id, 3.0));
          vec3 c0 = mix(vec3(0.33, 0.22, 0.085), vec3(0.52, 0.38, 0.16), k);
          c0 = mix(c0, vec3(0.28, 0.26, 0.17), step(0.86, sfHash12(vec2(id, 9.0))) * 0.6);
          float fib = sfNoise(vec2(su * 3.0, r * 160.0));
          float ridge = smoothstep(0.0, 0.3, f) * smoothstep(1.0, 0.7, f);
          float fade = 1.0 - smoothstep(0.2, 0.7, fwidth(su));
          col = mix(vec3(0.42, 0.3, 0.12), c0 * (0.82 + 0.28 * fib) * (0.78 + 0.22 * ridge), fade);
          float px = max(fwidth(rm), 1e-6) * 1.2;
          float rd = abs(fract(rm / 0.022 + 0.5) - 0.5) * 0.022;
          float dash = step(0.35, fract(u * 6.2831853 * rm / 0.006));
          float st = fgAAw(rd - 0.0006, px) * dash * step(0.035, rm) * step(rm, 0.23);
          col = mix(col, vec3(0.1, 0.065, 0.03), st * 0.85);
          // weathered: darker toward the rim, sun-bleached on top
          col *= mix(1.08, 0.82, smoothstep(0.5, 1.0, r));
          fgH = ridge * fade * 0.0003 + fib * 0.00005 - st * 0.0002;
          if (normalize(vObjN).y < -0.1) {
            float rib = fgAAw(abs(fract(u * 16.0 + 0.5) - 0.5) * 6.2831853 * rm / 16.0 - 0.0028, max(fwidth(u * 6.2831853 * rm), 1e-6));
            col = mix(col * 0.5, vec3(0.24, 0.14, 0.05), rib);
            fgH += rib * 0.001;
          }
          // the knot of sedge at the crown
          col = mix(col, vec3(0.2, 0.13, 0.05), smoothstep(0.045, 0.03, r));
        } else if (fgId(0.2)) {
          // the rim: a bamboo hoop bound in sedge
          float s = fract(vFUv.x * 0.6 + vFUv.y * 1.0);
          float b = smoothstep(0.0, 0.2, s) * smoothstep(1.0, 0.8, s);
          col = mix(vec3(0.16, 0.1, 0.04), vec3(0.45, 0.33, 0.14), b);
          fgH = b * 0.0004;
        } else if (fgId(0.25)) {
          col = manAi(0.15); rough = 0.9;
        } else if (fgId(0.4)) {
          // waraji: rice straw twined across four warp cords; trodden dark
          float along = vFUv.x, across = 1.0 - vFUv.y;
          float s = fract(along / 0.0045);
          float weft = smoothstep(0.0, 0.35, s) * smoothstep(1.0, 0.65, s);
          float warp = smoothstep(0.003, 0.0, min(abs(abs(across) - 0.011), abs(abs(across) - 0.029)));
          col = vec3(0.4, 0.29, 0.12) * (0.7 + 0.35 * weft) * (0.85 + 0.25 * sfNoise(vec2(along * 900.0, across * 200.0)));
          col = mix(col, vec3(0.3, 0.21, 0.08), warp * 0.5);
          if (normalize(vObjN).y < 0.3) col *= 0.55;
          fgH = weft * 0.0004 + warp * 0.0003;
        } else if (fgId(0.5) || fgId(0.7)) {
          // twisted cords: straw for the sandals, cotton for the hat's chin cord
          float s = fract(vFUv.x * 0.8 + vFUv.y * 2.0);
          float b = smoothstep(0.0, 0.3, s) * smoothstep(1.0, 0.7, s);
          col = fgId(0.5) ? vec3(0.44, 0.33, 0.14) : vec3(0.42, 0.39, 0.33);
          col *= 0.7 + 0.4 * b;
          fgH = b * 0.0003;
        } else {
          // kohaze: brass clasps
          col = vec3(0.72, 0.52, 0.2); rough = 0.38; metal = 1.0;
        }
        diffuseColor.rgb = col;
        fgRough = rough; fgMetal = metal;
      }`,
  });
}

// cropped short and going grey: dark roots shot with white, more at the temples
function manHairMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.014, 0.013, 0.012), roughness: 0.7 });
  return figMat(m, 'man-hair', {
    snow: 0.8,
    wet: 0.3,
    map: /* glsl */ `
      {
        float k = fgFade(vFUv.x * 300.0);
        float g = mix(0.3, step(0.6, sfNoise(vFUv * vec2(300.0, 180.0))), k);
        float temple = smoothstep(0.03, 0.08, abs(vObj.x)) * smoothstep(1.56, 1.48, vObj.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.29, 0.27), g * (0.25 + 0.4 * temple));
        fgH = g * 0.00008;
      }`,
    light: HAIR_LIGHT,
  });
}

// ---------------------------------------------------------------- set up
function adopt(root, byName, metres = false) {
  root.updateMatrixWorld(true);
  const D = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh) return;
    // in the bind pose any bone's world matrix times its (dequantising) inverse bind is the mesh's dequantisation
    if (metres && o.isSkinnedMesh) D.copy(o.bindMatrixInverse).multiply(o.skeleton.bones[0].matrixWorld).multiply(o.skeleton.boneInverses[0]);
    else D.identity();
    const g = o.geometry;
    if (g.attributes.color) {
      g.setAttribute('pid', g.attributes.color);
      g.deleteAttribute('color');
    }
    const swap = (m) => {
      const f = byName[m.name];
      if (f) {
        const n = f(m);
        n.userData.uDeq?.value.copy(D);
        return n;
      }
      // eyes, brows, lashes keep their textures and join the world's light and air
      m.vertexColors = false;
      return patch(m, { key: 'fig-' + m.name, snow: 0, wet: 0.2 });
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
    o.castShadow = true;
    o.receiveShadow = true;
    o.userData.figure = true;
  });
}

// the sendo, rigged for the boat: each frame his hips shift and dip with the stroke, his back leans and turns into
// it, his legs bend so his feet stay where they stand, his hands ride the ro and his arms follow them (two-bone IK
// on the skeleton, measured from his bind pose, which is mid-stroke with both hands on the ro)
const GRIPS = [new THREE.Vector3(0, 1.05, 0.48), new THREE.Vector3(0.23, 0.95, 0.4)];
export function createBoatman(src) {
  const once = (f) => { let m; return (s) => (m ||= f(s)); };
  adopt(src, {
    man_skin: once((m) => skinMaterial(m, true)),
    man_cloth: once(manClothMaterial),
    man_straw: once(strawMaterial),
    man_hair: once(manHairMaterial),
  }, true);
  const B = (n) => src.getObjectByName(n);
  src.updateMatrixWorld(true);
  const toFig = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const srcQ0 = src.getWorldQuaternion(new THREE.Quaternion()).invert();
  const fp = (o) => o.getWorldPosition(new THREE.Vector3()).applyMatrix4(toFig);
  const fq = (o) => srcQ0.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  const bones = [];
  src.traverse((o) => { if (o.isBone) bones.push([o, o.quaternion.clone(), o.position.clone()]); });
  const pelvis = B('pelvis'), pelvisF = fp(pelvis);
  const chain = (a, b, c) => ({ A: B(a), B: B(b), C: B(c) });
  const legs = ['l', 'r'].map((s) => ({ ...chain('thigh_' + s, 'calf_' + s, 'foot_' + s), end: fp(B('foot_' + s)), q: fq(B('foot_' + s)), mid: fp(B('calf_' + s)) }));
  const arms = ['r', 'l'].map((s, i) => ({ ...chain('upperarm_' + s, 'lowerarm_' + s, 'hand_' + s), end: fp(B('hand_' + s)), q: fq(B('hand_' + s)), mid: fp(B('lowerarm_' + s)), grip: GRIPS[i], sx: s === 'l' ? 1 : -1 }));
  const spine = ['spine_01', 'spine_02', 'spine_03'].map(B);
  const look = headLook({ root: src, neck: B('neck_01'), head: B('head') });

  const qs = new THREE.Quaternion(), qp = new THREE.Quaternion(), qt = new THREE.Quaternion(), dq = new THREE.Quaternion();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), d = new THREE.Vector3(), e = new THREE.Vector3();
  const pl = new THREE.Vector3(), w = new THREE.Vector3(), u1 = new THREE.Vector3(), u2 = new THREE.Vector3(), t = new THREE.Vector3(), pole = new THREE.Vector3();
  const AX = new THREE.Vector3();
  // turn a bone by a rotation given in world space
  const rotW = (bone, q) => {
    bone.parent.getWorldQuaternion(qp);
    qt.copy(qp).invert().multiply(q).multiply(qp);
    bone.quaternion.premultiply(qt);
    bone.updateMatrixWorld(true);
  };
  // give a bone a world orientation
  const setW = (bone, q) => {
    bone.parent.getWorldQuaternion(qp);
    bone.quaternion.copy(qp.invert().multiply(q));
    bone.updateMatrixWorld(true);
  };
  const twoBone = (ch, target, poleW) => {
    ch.A.getWorldPosition(a); ch.B.getWorldPosition(b); ch.C.getWorldPosition(c);
    const la = a.distanceTo(b), lb = b.distanceTo(c);
    d.subVectors(target, a);
    const dist = Math.min(Math.max(d.length(), Math.abs(la - lb) + 1e-3), (la + lb) * 0.999);
    d.normalize();
    const ca = (la * la + dist * dist - lb * lb) / (2 * la * dist), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
    pl.subVectors(poleW, a);
    pl.addScaledVector(d, -pl.dot(d)).normalize();
    e.copy(a).addScaledVector(d, la * ca).addScaledVector(pl, la * sa);
    rotW(ch.A, dq.setFromUnitVectors(u1.subVectors(b, a).normalize(), u2.subVectors(e, a).normalize()));
    ch.B.getWorldPosition(b); ch.C.getWorldPosition(c);
    w.copy(a).addScaledVector(d, dist);
    rotW(ch.B, dq.setFromUnitVectors(u1.subVectors(c, b).normalize(), u2.subVectors(w, b).normalize()));
  };

  // o: shift (forward, m), dip (m), lean (forward, rad), turn (rad), grips (world points under his right and left
  // hands), hands (world rotation of the ro since the bind pose), look (pitch, yaw, roll), feet (optional world
  // points for his left and right ankles; by default they stay where they stood in the bind pose)
  function pose(o) {
    for (const [bone, q, p] of bones) { bone.quaternion.copy(q); bone.position.copy(p); }
    src.updateMatrixWorld(true);
    src.getWorldQuaternion(qs);
    t.set(0, -o.dip, o.shift).add(pelvisF);
    src.localToWorld(t);
    pelvis.position.copy(pelvis.parent.worldToLocal(t));
    pelvis.updateMatrixWorld(true);
    const share = [0.4, 0.35, 0.25];
    for (let i = 0; i < 3; i++) {
      rotW(spine[i], dq.setFromAxisAngle(AX.set(1, 0, 0).applyQuaternion(qs), o.lean * share[i]));
      rotW(spine[i], dq.setFromAxisAngle(AX.set(0, 1, 0).applyQuaternion(qs), o.turn * share[i]));
    }
    for (const [i, L] of legs.entries()) {
      if (o.feet) t.copy(o.feet[i]); else src.localToWorld(t.copy(L.end));
      src.localToWorld(pole.copy(L.mid).add(u1.set(0, 0, 0.5)));
      twoBone(L, t, pole);
      setW(L.C, qt.copy(qs).multiply(L.q));
    }
    for (let i = 0; i < 2; i++) {
      const A = arms[i];
      // the wrist keeps its bind offset from the hand's grip, turned with the ro
      u1.subVectors(A.end, A.grip).applyQuaternion(qs).applyQuaternion(o.hands);
      t.copy(o.grips[i]).add(u1);
      src.localToWorld(pole.copy(A.mid).add(u2.set(A.sx * 0.3, -0.35, -0.15)));
      twoBone(A, t, pole);
      setW(A.C, qt.copy(o.hands).multiply(qs).multiply(A.q));
    }
    look(o.look[0], o.look[1], o.look[2]);
  }
  // hang something on a bone so it sits at fig (figure frame) in the bind pose and moves with the bone after
  function attach(obj, bone, fig) {
    const bn = B(bone);
    const M = new THREE.Matrix4().copy(toFig).multiply(bn.matrixWorld).invert().multiply(new THREE.Matrix4().makeTranslation(fig.x, fig.y, fig.z));
    M.decompose(obj.position, obj.quaternion, obj.scale);
    bn.add(obj);
  }
  // pelvis: where his hips are in the bind pose (figure frame), for seating him
  return { root: src, pose, attach, pelvis: pelvisF.clone() };
}

// turn a head on its neck: the neck takes part of the turn, the head the rest, both about axes fixed in the
// figure's frame (so yaw is about her vertical whatever the bones' own frames)
const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _e = new THREE.Euler();
export function headLook(fig) {
  const { neck, head } = fig;
  fig.root.updateMatrixWorld(true);
  const inFig = (b) => {
    const m = new THREE.Matrix4().copy(fig.root.matrixWorld).invert().multiply(b.matrixWorld);
    return new THREE.Quaternion().setFromRotationMatrix(m);
  };
  const neckParent = inFig(neck.parent), neckW = inFig(neck);
  const headW = inFig(head);
  return (pitch, yaw, roll, share = 0.4) => {
    // neck: world delta d1 -> local = parent^-1 * d1 * neckW
    _e.set(pitch * share, yaw * share, roll * share, 'YXZ');
    _q.setFromEuler(_e);
    const nW = _p.copy(_q).multiply(neckW);
    neck.quaternion.copy(neckParent).invert().multiply(nW);
    // head: total delta, relative to the turned neck
    _e.set(pitch, yaw, roll, 'YXZ');
    _q.setFromEuler(_e).multiply(headW);
    head.quaternion.copy(nW).invert().multiply(_q);
  };
}
