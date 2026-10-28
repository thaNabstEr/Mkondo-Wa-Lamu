// Pure tree placement for the generation workers: the mangrove forest. Output per set: Float32Array of
// [x, y, z, rotY, scale, tiltX, tiltZ, kind, bright, warm] records (see mangroves.js for how each set is drawn).
//   bank   the rank standing in the water's edge along both banks, leaning out over the channel: red mangroves, with
//          stands of black mangrove
//   inner  the forest behind them out to the haze: red mangrove clumps (the Rhizophora scan) close behind the bank,
//          red mangroves, black mangroves in patches, the lighter tree further back
// kind indexes KINDS. bright and warm tint each tree (-1..1), so no two neighbours are quite the same green. The
// trees stand on their root plane; it is set on the bed or the mud where they stand, so the roots below it run into
// the mud and the water.
import { rng, smoothstep, vnoise } from '../lib/math.js';
import { riverAt, terrainHeight, waterSd, forestAt } from './layout.js';
import { blocked } from './sites.js';

export const SPECIES = ['bank', 'inner'];
export const KINDS = ['red', 'light', 'rhizo', 'brug'];
export const TREE_STRIDE = 10;
const RED = 0, LIGHT = 1, RHIZO = 2, BRUG = 3;

// the bank's edge on one side at z: where the water ends, found by bisection out from the centre line
function bankX(z, side) {
  const r = riverAt(z);
  let a = r.x, b = r.x + side * (r.w * 1.6 + 12);
  if (waterSd(b, z) < 0) return null;
  for (let i = 0; i < 18; i++) {
    const m = (a + b) / 2;
    if (waterSd(m, z) < 0) a = m; else b = m;
  }
  return (a + b) / 2;
}

export function placeTrees(zFrom, zTo, seed) {
  const R = rng(seed);
  const out = { bank: [], inner: [] };
  // a tree leaning toward the world direction (dx, dz) by a radians: the record's tilts are in the tree's own
  // (yawed) frame. Its tint drifts slowly through the forest (stands of one shade) with a little of its own.
  const put = (set, x, z, s, kind, dx = 0, dz = 0, a = 0) => {
    const yaw = R.next() * Math.PI * 2;
    const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
    const jx = R.range(-0.04, 0.04), jz = R.range(-0.04, 0.04);
    const bright = (vnoise(x * 0.03 + 11, z * 0.03) - 0.5) * 1.4 + R.range(-0.35, 0.35);
    const warm = (vnoise(x * 0.02 - 7, z * 0.02 + 3) - 0.5) * 1.6 + R.range(-0.3, 0.3);
    out[set].push(x, terrainHeight(x, z), z, yaw, s, a * lz + jx, -a * lx + jz, kind, bright, warm);
  };
  const inRange = (z) => z <= zFrom && z > zTo;
  // an occasional emergent standing well above the canopy
  const emergent = (s) => (R.next() < 0.03 ? s * R.range(1.45, 1.8) : s);

  // the bank rank: a tree every 2.5-4.5 m along both banks, standing in the edge of the water, its crown out over the
  // channel, so the roots make one wall and the crowns close over the narrow creeks. The wall is not a hedge: the
  // crowns rise and fall in stands (slow noise along the bank), some lean far out and some hardly at all, the edge
  // wanders in and out, and here and there a low stretch of young trees makes a dip in the canopy (the roots carry on)
  for (const side of [-1, 1]) {
    for (let z = zFrom; z > zTo; z -= R.range(2.5, 4.5)) {
      if (!inRange(z)) continue;
      const zz = z + R.range(-0.8, 0.8);
      const edge = bankX(zz, side);
      if (edge === null) continue;
      const nz = zz * 0.035 + side * 17;
      const stand = vnoise(nz, 3.1);
      const out_ = vnoise(nz * 1.7, 9.4);
      const x = edge + side * (R.range(-0.8, 0.8) - 1.0 * out_);
      if (blocked(x, zz, 1)) continue;
      const dip = vnoise(nz * 2.3, 5.7) < 0.22;
      let s = dip ? R.range(0.55, 0.72) : (0.78 + 0.5 * stand) * R.range(0.92, 1.08);
      s = emergent(s);
      const lean = 0.04 + 0.42 * Math.pow(out_, 1.6) + R.range(-0.04, 0.04);
      // black mangroves in stands of their own along the bank (they grow on the firmer, landward side, so fewer)
      const kind = vnoise(nz * 0.6, 21.3) > 0.68 && R.next() < 0.7 ? BRUG : RED;
      put('bank', x, zz, s, kind, -side, 0, lean);
    }
  }

  // the forest behind: a jittered grid that opens out with distance from the water. Close behind the bank stand the
  // red mangrove clumps (their stilt roots a second wall behind the first); then red mangroves, with black mangroves
  // in patches and the lighter tree further back. Sizes swell and shrink in stands.
  const RING = [[100, 5], [300, 7], [700, 10]];
  const offsets = [0];
  for (let d = 0, k = 0; k < RING.length;) { d += RING[k][1]; if (d > RING[k][0]) { k++; continue; } offsets.push(d); }
  const STEP = 5;
  for (let z = Math.floor(zFrom / STEP) * STEP; z > zTo; z -= STEP) {
    const cx = riverAt(z).x;
    for (const side of [-1, 1]) {
      for (const off of offsets) {
        const sp = off < 100 ? 5 : off < 300 ? 7 : 10;
        // rows further out are sparser along the channel too
        if (sp > STEP && R.next() > STEP / sp) continue;
        const x = cx + side * off + R.range(-sp * 0.45, sp * 0.45);
        const zz = z + R.range(-2.4, 2.4);
        if (!inRange(zz)) continue;
        const sd = waterSd(x, zz);
        if (sd < 2.5) continue;
        const h = terrainHeight(x, zz);
        if (R.next() > forestAt(x, zz, h, sd)) continue;
        if (blocked(x, zz, 1)) continue;
        const stand = vnoise(x * 0.025, zz * 0.025);
        const s = emergent((0.85 + 0.55 * stand) * R.range(0.92, 1.08));
        let kind = RED;
        const patch = vnoise(x * 0.012 + 40, zz * 0.012);
        // (not right at the water: a card that close to the boat would read as a board)
        if (sd > 7 && sd < 26 && R.next() < 0.25) kind = RHIZO;
        else if (patch > 0.62) kind = BRUG;
        else if (R.next() < smoothstep(10, 120, sd) * 0.3 * (0.5 + vnoise(x * 0.02, zz * 0.02))) kind = LIGHT;
        else if (sd > 40 && R.next() < 0.2) kind = RHIZO;
        // a clump card is a whole stand of trees: smaller scale, it is already broad
        put('inner', x, zz, kind === RHIZO ? s * R.range(0.62, 0.85) : s, kind);
      }
    }
  }
  const packed = {};
  for (const k of SPECIES) packed[k] = new Float32Array(out[k]);
  return packed;
}
