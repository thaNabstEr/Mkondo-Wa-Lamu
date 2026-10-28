// The voyage: a path down the channel's centre, from Lamu through the creeks and out onto the open water.
// Owns the boat's progress, the steering offset, and the day/weather schedule that follows the journey.
import { riverAt, terrainHeight, PLACES, Z_START, Z_END } from '../world/layout.js';
import { HULL } from '../world/hull.js';
import { clamp, lerp, smoothstep } from '../lib/math.js';

// the last stretch, where the boat eases to a drift on the open water
const DRIFT = 140;

// Where the hull can touch: points round it in the boat's frame (x to starboard, z forward). The boat is aground
// wherever the bed under any of them rises above CLEAR below the surface: the banks and the sandbars alike.
const CLEAR = 0.35;
const cz = HULL.z0 + HULL.len / 2, bw = HULL.beam;
const HULL_PTS = [
  [0, HULL.box.z1 - 0.35], [0, HULL.box.z0 + 0.5],
  [bw * 0.95, cz], [-bw * 0.95, cz],
  [bw * 0.75, cz + HULL.len * 0.3], [-bw * 0.75, cz + HULL.len * 0.3],
  [bw * 0.75, cz - HULL.len * 0.3], [-bw * 0.75, cz - HULL.len * 0.3],
];
// speed through the water with the sail down (the current and a little way on her) and with it fully up, m/s
const BARE = 0.4, FULL = 5.6;

function buildPath() {
  const raw = [];
  for (let z = Z_START; z > Z_END; z -= 2) raw.push([riverAt(z).x, z]);
  // smooth the centre line so the boat never zigzags with the banks
  const sm = raw.map((p, i) => {
    let sx = 0, n = 0;
    for (let k = -8; k <= 8; k++) {
      const q = raw[Math.max(0, Math.min(raw.length - 1, i + k))];
      sx += q[0]; n++;
    }
    return [i < 4 || i > raw.length - 5 ? p[0] : sx / n, p[1]];
  });
  const len = new Float32Array(sm.length);
  for (let i = 1; i < sm.length; i++) len[i] = len[i - 1] + Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]);
  return { pts: sm, len, total: len[len.length - 1] };
}

// when on the journey (0..1) it is what time of day: early morning leaving Lamu, the sun going down as the
// channel opens onto the water
const DAY = [
  [0.0, 6.3], [0.08, 7.4], [0.22, 9.6], [0.4, 12.4], [0.58, 15.0], [0.74, 16.8], [0.86, 17.7], [0.94, 18.15],
  [1.0, 18.45],
];

export class Journey {
  constructor() {
    const p = buildPath();
    this.pts = p.pts;
    this.len = p.len;
    this.total = p.total;
    this.s = 0;
    this.speed = 0;
    // underway (target > 0, where the sail sets the speed) or moored (0); Space switches between them
    this.cruise = 4.6;
    this.target = this.cruise;
    this.lat = 0;
    this.latV = 0;
    this.steer = 0;
    this.thrust = 0;
    // the sail, 0 lowered .. 1 fully raised: W raises it, S lowers it; it sets the speed
    this.sail = 0.75;
    // a knock against a bank or a sandbar: a sideways jolt that dies away, and a callback (strength 0..1)
    this.jolt = 0;
    this.bumpWait = 0;
    this.onBump = null;
    this.loop = 0;
    this.pose = { x: 0, z: 0, heading: Math.PI, speed: 0, lean: 0 };
    this.placeIdx = -1;
    this.onPlace = null;
    this.onLoopEnd = null;
    this._i = 0;
    this.ended = false;
  }

  get progress() { return this.s / this.total; }

  sAtZ(z) {
    for (let i = 1; i < this.pts.length; i++) if (this.pts[i][1] <= z) return this.len[i];
    return 0;
  }

  hourAt(f = this.progress) {
    for (let i = 1; i < DAY.length; i++) {
      if (f <= DAY[i][0]) {
        const t = (f - DAY[i - 1][0]) / (DAY[i][0] - DAY[i - 1][0]);
        return lerp(DAY[i - 1][1], DAY[i][1], smoothstep(0, 1, t));
      }
    }
    return DAY[DAY.length - 1][1];
  }

  // the weather each stretch asks for; the coastal weather moods take this over later in Phase 1
  weatherAt(z, season) {
    return 'clear';
  }

  placeAt(z) {
    let idx = -1;
    for (let i = 0; i < PLACES.length; i++) if (z <= PLACES[i].z) idx = i;
    return idx;
  }

  sample(s, out) {
    s = clamp(s, 0, this.total);
    let i = this._i;
    while (i < this.len.length - 2 && this.len[i + 1] < s) i++;
    while (i > 0 && this.len[i] > s) i--;
    this._i = i;
    const a = this.pts[i], b = this.pts[i + 1];
    const t = (s - this.len[i]) / Math.max(1e-6, this.len[i + 1] - this.len[i]);
    out.x = a[0] + (b[0] - a[0]) * t;
    out.z = a[1] + (b[1] - a[1]) * t;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    out.tx = dx / l; out.tz = dz / l;
    return out;
  }

  // how far the hull is aground at offset lat from the centre line, here: > 0 when touching (metres of bed above the
  // clearance at the worst point), and on which side
  aground(c, lat, heading) {
    const nx = -c.tz, nz = c.tx;
    const x = c.x + nx * lat, z = c.z + nz * lat;
    const ch = Math.cos(heading), sh = Math.sin(heading);
    let worst = -1, side = 0;
    for (const [bx, bz] of HULL_PTS) {
      const px = x + bx * ch + bz * sh, pz = z - bx * sh + bz * ch;
      const d = terrainHeight(px, pz) + CLEAR;
      if (d > worst) { worst = d; side = (px - c.x) * nx + (pz - c.z) * nz - lat; }
    }
    return worst > 0 ? { depth: worst, side: Math.sign(side) || 1 } : null;
  }

  reset(loop) {
    this.s = 0;
    this._i = 0;
    this.lat = 0;
    this.latV = 0;
    this.jolt = 0;
    this.loop = loop;
    this.placeIdx = -1;
    this.ended = false;
  }

  // move straight to a stretch of river, as if the boat had always been there
  jump(s) {
    this.s = clamp(s, 0, this.total - 1);
    this._i = 0;
    this.lat = 0;
    this.latV = 0;
    this.ended = false;
    const c = this.sample(this.s, this._c || (this._c = {}));
    this.placeIdx = this.placeAt(c.z) - 1;
    this.pose.heading = Math.atan2(c.tx, c.tz);
  }

  update(dt) {
    // the sail sets the speed: raised or lowered a little at a time while W or S is held
    this.sail = clamp(this.sail + this.thrust * dt / 2.5, 0, 1);
    // underway (target > 0) or moored; over the last stretch she eases off to a drift on the open water
    const drift = lerp(0.18, 1, smoothstep(0, DRIFT, this.total - this.s));
    const want = (this.target > 0 ? BARE + this.sail * (FULL - BARE) : 0) * drift;
    this.speed += (want - this.speed) * (1 - Math.exp(-dt * (want > this.speed ? 0.45 : 0.9)));
    this.s += this.speed * dt;
    if (this.s >= this.total) {
      this.s = this.total;
      if (!this.ended) {
        this.ended = true;
        this.onLoopEnd && this.onLoopEnd();
      }
    }
    const c = this.sample(this.s, this._c || (this._c = {}));
    // steering: a sideways drift with inertia, stopped by the banks and the sandbars
    this.latV += (this.steer * 2.2 - this.latV) * (1 - Math.exp(-dt * 1.4));
    if (!this.steer) this.lat *= Math.exp(-dt * 0.08);
    const lim = Math.max(1.5, riverAt(c.z).w);
    const heading = Math.atan2(c.tx, c.tz) - this.latV * 0.08 - this.jolt;
    const lat1 = clamp(this.lat + this.latV * dt * (0.4 + this.speed * 0.15), -lim, lim);
    this.bumpWait -= dt;
    const hit = this.aground(c, lat1, heading);
    if (!hit) this.lat = lat1;
    else {
      // she touches: slide off to the nearest offset where she floats, the sideways way rebounds a little, and the
      // knock costs way
      let free = null;
      for (let k = 1; k <= 80 && free === null; k++) {
        for (const sg of [-hit.side, hit.side]) {
          if (!this.aground(c, lat1 + sg * k * 0.08, heading)) { free = lat1 + sg * k * 0.08; break; }
        }
      }
      const away = free === null ? -hit.side : Math.sign(free - lat1) || -hit.side;
      const strength = clamp(Math.abs(this.latV) * 0.35 + this.speed * 0.09 + hit.depth * 0.5, 0, 1);
      if (free !== null) this.lat = free;
      this.latV = away * Math.max(0.25, Math.abs(this.latV) * 0.3);
      this.speed *= free === null ? 0.5 : 1 - 0.45 * strength;
      if (this.bumpWait <= 0 && strength > 0.08) {
        this.bumpWait = 0.5;
        this.jolt += away * 0.06 * strength;
        this.onBump && this.onBump(strength);
      }
    }
    this.jolt *= Math.exp(-dt * 2.5);
    const nx = -c.tz, nz = c.tx;
    const x = c.x + nx * this.lat, z = c.z + nz * this.lat;
    const p = this.pose;
    // smooth heading through the polyline corners
    let dh = heading - p.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    p.heading += dh * (1 - Math.exp(-dt * 2.5));
    p.x = x; p.z = z;
    p.speed = this.speed;
    p.lean = -this.latV * 0.4 + this.jolt * 3;
    p.sail = this.sail;
    p.steer = this.steer;

    const idx = this.placeAt(c.z);
    if (idx !== this.placeIdx && idx > this.placeIdx) {
      this.placeIdx = idx;
      this.onPlace && this.onPlace(PLACES[idx], idx);
    }
    return p;
  }
}
