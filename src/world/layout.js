// The channel: centreline, widths, sandbars, terrain height, building pads, places and the boat's path.
// Water level is y = 0, the boat travels toward -z, +x is the right bank as seen from the boat.
// A flat mangrove coast: the land is mud a hand or two above the water, and all the height comes from the canopy.
// The route runs from Lamu (Amu) along the Manda mangroves, through narrow creeks and wider reaches, and opens into
// the water toward Matondoni at sunset; distances are compressed (the real way round is about 10 km).
import { clamp, lerp, smoothstep, fbm, vnoise } from '../lib/math.js';

// z, x (centre), w (water half-width), d (bed depth)
const CP = [
  [700, 0, 50, 3.0],
  [300, 10, 50, 3.0],
  [60, 0, 46, 2.8],
  // Lamu's waterfront: a broad channel, the mangroves of Manda opposite
  [-120, -20, 30, 2.5],
  [-300, -45, 18, 2.2],
  [-450, -20, 16, 2.0],
  [-600, 25, 14, 1.8],
  // the first creek, 9-10 m of water between the roots: the canopy meets overhead
  [-720, 40, 8, 1.5],
  [-820, 25, 4.8, 1.2],
  [-920, 5, 4.5, 1.1],
  [-1020, 15, 5, 1.2],
  [-1120, 35, 8, 1.5],
  // a wider reach, bending
  [-1250, 45, 18, 2.0],
  [-1400, 15, 20, 2.2],
  [-1550, -25, 15, 2.0],
  // the second creek
  [-1680, -35, 6, 1.4],
  [-1800, -20, 5, 1.2],
  [-1920, 0, 8, 1.5],
  // the mouth, then open water toward the setting sun
  [-2050, 10, 20, 2.2],
  [-2170, 15, 90, 3.0],
  [-2300, 20, 260, 4.0],
  [-2500, 20, 600, 5.0],
  [-2960, 20, 900, 6.0],
  [-3800, 20, 1100, 6.0],
];

export const Z_START = 40;
// the route ends drifting out on the open water
export const Z_END = -2380;
// low mangrove islands on the far side of the open water, for the horizon: x, z, r
const ISLES = [[-300, -2760, 130], [420, -2640, 95], [90, -3000, 230]];

// sandbars on the inside of a bend, at the bend's apex: z, half-length along the channel (m)
const BARS = [[-300, 40], [-1250, 46]];

const N = CP.length;
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

const _r = { x: 0, w: 0, d: 0, slope: 0, cos: 1 };
// interpolated channel parameters at z; returns a shared object, copy if kept
export function riverAt(z) {
  let i = 0;
  if (z >= CP[0][0]) i = 0;
  else if (z <= CP[N - 1][0]) i = N - 2;
  else while (i < N - 2 && CP[i + 1][0] > z) i++;
  const a = CP[Math.max(0, i - 1)], b = CP[i], c = CP[i + 1], e = CP[Math.min(N - 1, i + 2)];
  const t = clamp((b[0] - z) / (b[0] - c[0]), 0, 1);
  const x = cr(a[1], b[1], c[1], e[1], t);
  const s = t * t * (3 - 2 * t);
  _r.x = x;
  _r.w = lerp(b[2], c[2], s);
  _r.d = lerp(b[3], c[3], s);
  const dz = 0.5;
  const tt = clamp((b[0] - (z - dz)) / (b[0] - c[0]), 0, 1);
  const x2 = cr(a[1], b[1], c[1], e[1], tt);
  _r.slope = (x2 - x) / dz;
  _r.cos = 1 / Math.sqrt(1 + _r.slope * _r.slope);
  return _r;
}

export const riverX = (z) => riverAt(z).x;

// how open the water is here, 0 in the creeks .. 1 out on the open water
export const openAt = (w) => smoothstep(50, 200, w);

// noisy half-width per bank, so the two shores never run parallel
function bankW(r, z, side) {
  return r.w * (1 + 0.13 * fbm(z * 0.021 + side * 31.7, side * 4.1, 3)) + 1.2 * vnoise(z * 0.11, side * 9.3);
}

// signed horizontal distance to the open water (negative on water)
export function waterSd(x, z) {
  const r = riverAt(z);
  const side = x >= r.x ? 1 : -1;
  const dx = Math.abs(x - r.x) * r.cos;
  let sd = dx - bankW(r, z, side);
  // the far islands rise out of the open water
  for (const [ix, iz, ir] of ISLES) {
    const d = Math.hypot(x - ix, z - iz);
    if (d > ir * 1.4) continue;
    const ang = Math.atan2(z - iz, x - ix);
    sd = Math.max(sd, ir * (1 + 0.12 * Math.sin(ang * 3 + ix) + 0.06 * Math.sin(ang * 7 - iz)) - d);
  }
  return sd;
}

// building pads: terrain is flattened to y inside r, blending out over f
export const PADS = [];
export function addPad(x, z, r, y, f = 8) { PADS.push({ x, z, r, y, f }); }

// a sandbar on the inside of a bend: the bed climbs from the deep outer side to just above the water by the inner
// bank, a long lens along the channel. Inside is the side the channel curves toward.
function sandbar(x, z, r, h) {
  for (const [zc, half] of BARS) {
    const v = (z - zc) / half;
    if (Math.abs(v) >= 1) continue;
    const xa = riverAt(zc - 20).x, xb = riverAt(zc + 20).x, xc = riverAt(zc).x;
    const inside = xa + xb - 2 * xc > 0 ? 1 : -1;
    const u = ((x - r.x) * inside) / Math.max(r.w, 1); // -1 outer bank .. 1 inner bank
    const crest = -0.9 + 1.12 * smoothstep(-0.1, 0.75, u) + 0.06 * fbm(x * 0.2, z * 0.2, 2);
    const env = 1 - smoothstep(0.45, 1, Math.abs(v) + 0.25 * Math.max(0, 0.2 - u));
    h = Math.max(h, lerp(h, crest, env));
  }
  return h;
}

export function terrainHeight(x, z) {
  const r = riverAt(z);
  const w = r.w, d = r.d;
  const sd = waterSd(x, z);
  let h;
  if (sd < 0) {
    // bed: a parabolic channel shelving up through soft mud at the edges, a little noise
    const k = clamp(-sd / Math.max(4, Math.min(w, 60)), 0, 1);
    h = -d * Math.pow(1 - (1 - k) * (1 - k), 0.85) + 0.25 * fbm(x * 0.15, z * 0.15, 2) * k;
    h = Math.min(h, -0.05 - 0.4 * k);
    h = sandbar(x, z, r, h);
  } else {
    // the bank: a short climb out of the water onto mud flats that barely rise, then the dry land far behind
    const bank = 0.42 * smoothstep(0, 5, sd);
    const flat = 0.28 * smoothstep(5, 60, sd) * (0.6 + 0.4 * fbm(x * 0.03, z * 0.03, 3));
    const ripple = 0.08 * fbm(x * 0.4, z * 0.4, 2) * smoothstep(0, 3, sd);
    const dry = 2.2 * smoothstep(220, 700, sd) * (0.6 + 0.6 * fbm(x * 0.006 + 2.0, z * 0.006, 3));
    h = bank + flat + ripple + dry;
  }
  for (let i = 0; i < PADS.length; i++) {
    const p = PADS[i];
    const dd = Math.hypot(x - p.x, z - p.z);
    if (dd < p.r + p.f) h = lerp(h, p.y, smoothstep(p.r + p.f, p.r, dd));
  }
  return h;
}

// forest density: the mangrove stands close right down to the water; only the dry land far behind thins out
export function forestAt(x, z, h, sd) {
  let f = smoothstep(-1, 3, sd) * (0.85 + 0.25 * fbm(x * 0.011 + 7.0, z * 0.011, 3));
  f *= 1 - smoothstep(1.8, 2.8, h) * 0.5;
  return clamp(f, 0, 1);
}

export function terrainNormal(x, z, e = 0.8, out = [0, 1, 0]) {
  const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  const l = Math.hypot(hx, 2 * e, hz);
  out[0] = -hx / l; out[1] = (2 * e) / l; out[2] = -hz / l;
  return out;
}

// chapters along the journey; z is where the title appears. sw: the Kiswahili name, en: the English.
// Amu, Manda and Matondoni are real places on this route; the creek and reach between them are named by what they
// are, as placeholders until their real names are confirmed.
export const PLACES = [
  { id: 'amu', z: 10, sw: 'Amu', en: 'Lamu' },
  { id: 'manda', z: -250, sw: 'Mikoko ya Manda', en: 'The Manda Mangroves' },
  { id: 'creek', z: -700, sw: 'Mkondo Mwembamba', en: 'The Narrow Creek', placeholder: true },
  { id: 'reach', z: -1160, sw: 'Maji Mapana', en: 'The Wide Reach', placeholder: true },
  { id: 'matondoni', z: -2030, sw: 'Matondoni', en: 'Toward Matondoni' },
];
