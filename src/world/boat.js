// The mashua: a Lamu dhow under a lateen sail, the Lamu eye on the sail and a painted board on each bow (the
// downloaded model, processed by pipeline/lamu/dhow.py), with Sakura's boatman sitting at the helm on the stern
// deck. Three nodes: the hull with its spars, rigging and fittings; the sail (with the eye) on its own so it can be
// raised and lowered; and the rudder with its head and tiller, which turns on its hinge as she is steered. Everything
// is animated per frame.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { U, patch, ktx2 } from '../core/shared.js';
import { createBoatman } from './figures.js';
import { HULL } from './hull.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const BOAT_URL = './assets/models/';
async function loadGLB(renderer, url, onProgress) {
  const g = await new GLTFLoader().setKTX2Loader(ktx2(renderer)).setMeshoptDecoder(MeshoptDecoder)
    .loadAsync(url, (e) => { if (onProgress && e.total) onProgress(e.loaded / e.total); });
  return g.scene;
}
export const loadBoat = (renderer, onProgress) => loadGLB(renderer, BOAT_URL + 'dhow.glb', onProgress);
// the same boat with fuller geometry and uncompressed-quality textures, streamed in after the first frame
export const loadBoatHi = (renderer) => loadGLB(renderer, BOAT_URL + 'hi/dhow.glb');

// the water leaves its mark on the outside of the hull: below the surface the planks darken, green and stay wet.
// furl: for the sail's materials, uniforms that gather the cloth up onto its yard as it is lowered. The cloth (and
// the eye painted on it) is canvas: with the sun behind it, it glows with the light coming through.
const CLOTH = new Set(['sail', 'emblem']);
function boatMaterial(m, furl) {
  m.aoMapIntensity = 0.75;
  patch(m, {
    key: 'boat-' + m.name + (furl ? '-furl' : ''),
    snow: m.name === 'sail' ? 1.2 : 1,
    wet: 0.8,
    uniforms: furl || {},
    vertexHead: furl ? 'uniform vec3 uYardA, uYardB; uniform float uFurl;' : '',
    fragHead: 'float sfHullWet = 0.0;' + (furl ? ' uniform float uFurl;' : ''),
    hooks: {
      // each point of the cloth slides toward the nearest point of the yard
      vertex: furl ? /* glsl */ `
        {
          vec3 yd = uYardB - uYardA;
          vec3 onYard = uYardA + clamp(dot(transformed - uYardA, yd) / dot(yd, yd), 0.0, 1.0) * yd;
          transformed = mix(transformed, onYard, uFurl * 0.94);
        }` : '',
      map: /* glsl */ `
        {
          vec3 nw = inverseTransformDirection(normalize(vNormal), viewMatrix);
          vec2 rt = vec2(cos(uBoat.z), -sin(uBoat.z));
          float out_ = max(step(0.3, dot(nw.xz, rt) * sign(dot(vSfWP.xz - uBoat.xy, rt))), step(0.5, -nw.y));
          float wl = smoothstep(0.09, -0.03, vSfWP.y) * out_;
          diffuseColor.rgb *= mix(vec3(1.0), vec3(0.26, 0.28, 0.2), wl);
          sfHullWet = wl;
        }`,
      normal: 'roughnessFactor = mix(roughnessFactor, roughnessFactor * 0.4, sfHullWet);',
      // the face turned away from the sun takes the light through the weave (less as it gathers onto the yard)
      light: furl && CLOTH.has(m.name) ? /* glsl */ `
        {
          float through = max(dot(-sfNW, uSunDir), 0.0);
          reflectedLight.directDiffuse += material.diffuseColor * uSunCol * (0.12 + 0.5 * through) * through * sfShadow * (1.0 - uFurl);
        }` : '',
    },
  });
  return m;
}

const SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'];

// The yard, in the boat's frame: the cloth's longest edge is the one laced to it (a lateen's head), so its two
// furthest-apart points are the yard's ends
function yardOf(sailNode) {
  sailNode.updateWorldMatrix(true, true);
  const toBoat = new THREE.Matrix4().copy(sailNode.parent.matrixWorld).invert();
  let cloth = null;
  sailNode.traverse((o) => { if (o.isMesh && o.material.name === 'sail') cloth = o; });
  const pa = cloth.geometry.attributes.position, m = new THREE.Matrix4().multiplyMatrices(toBoat, cloth.matrixWorld);
  const pts = [];
  for (let i = 0; i < pa.count; i++) pts.push(new THREE.Vector3().fromBufferAttribute(pa, i).applyMatrix4(m));
  let a = pts[0], b = pts[0], best = 0;
  for (const p of pts) for (const q of pts) { const d = p.distanceToSquared(q); if (d > best) { best = d; a = p; b = q; } }
  return [a, b];
}

// a model's meshes as boat parts: the boat material, and for the sail the furling, with the yard given in each
// mesh's own frame (meshopt keeps each mesh's dequantisation in its transform)
function prepare(node, furl) {
  const yard = furl ? yardOf(node) : null;
  node.updateWorldMatrix(true, true);
  const toBoat = new THREE.Matrix4().copy(node.parent.matrixWorld).invert();
  node.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.boatPart = true;
    o.castShadow = true; o.receiveShadow = true;
    if (o.material.userData.sfBoat) {
      if (!furl || o.material.userData.sfFurl) return;
      // a material the hull shares (the rope of the rings that lace the sail to the yard): the sail takes its own
      // copy, so the rings gather up with the cloth
      o.material = o.material.clone();
      o.material.userData = {};
    }
    o.material.userData.sfBoat = true;
    if (furl) o.material.userData.sfFurl = true;
    let u = null;
    if (furl) {
      const toMesh = new THREE.Matrix4().multiplyMatrices(toBoat, o.matrixWorld).invert();
      u = { uFurl: furl, uYardA: { value: yard[0].clone().applyMatrix4(toMesh) }, uYardB: { value: yard[1].clone().applyMatrix4(toMesh) } };
    }
    boatMaterial(o.material, u);
  });
}

// the floor or deck height on the centre line at z (boat frame), from the measured profile
function deckAt(z) {
  const d = HULL.deck;
  let best = d[0];
  for (const p of d) if (Math.abs(p[0] - z) < Math.abs(best[0] - z)) best = p;
  return best[1];
}

export function createBoat(tex, src, figs) {
  const root = new THREE.Group();
  root.name = 'boat';

  // ---- the boat model
  const hullNode = src.getObjectByName('hull');
  const sailNode = src.getObjectByName('sail');
  const rudderNode = src.getObjectByName('rudder');
  root.add(hullNode, sailNode);
  const furl = { value: 0 };
  prepare(hullNode, null);
  prepare(sailNode, furl);

  // ---- the rudder turns about its raked hinge (measured from its irons): it hangs in a frame whose origin is on the
  // hinge, so turning that frame about the hinge's direction swings the blade one way and the tiller the other
  const H = HULL.helm;
  const hinge = new THREE.Group(), hung = new THREE.Group();
  const axis = V(...H.axis).normalize();
  hinge.position.set(...H.pin);
  hung.position.set(-H.pin[0], -H.pin[1], -H.pin[2]);
  hinge.add(hung);
  root.add(hinge);
  hung.add(rudderNode);
  prepare(rudderNode, null);
  // where the helmsman's hand holds the tiller, carried round with it
  const grip = new THREE.Object3D();
  grip.position.set(...H.grip);
  hung.add(grip);
  let rudder = 0;
  const RUDDER_MAX = 0.3;

  // ---- the boatman sits at the helm on the port gunwale, turned a little inboard, his feet on the floor, his right
  // hand on the tiller beside him and his left on his knee. (Dressing him as a nahodha comes later.)
  const man = createBoatman(figs.boatman);
  const SEAT = V(0.31, 1.085, -2.45), FLOOR_Y = 0.70, FOOT_Z = -2.18, SEAT_YAW = -0.3;
  const rower = new THREE.Group();
  // his hips rest a hand's breadth above the gunwale; he turns about them
  rower.position.set(SEAT.x, SEAT.y + 0.09, SEAT.z);
  rower.rotation.y = SEAT_YAW;
  man.root.position.set(-man.pelvis.x, -man.pelvis.y, -man.pelvis.z);
  rower.add(man.root);
  root.add(rower);
  const FEET = [V(0.33, FLOOR_Y + 0.085, FOOT_Z), V(0.12, FLOOR_Y + 0.085, FOOT_Z - 0.04)];
  const KNEE_L = V(0.30, SEAT.y + 0.2, FOOT_Z + 0.08);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.matrixAutoUpdate = true; } });

  // no lamp on the dhow yet: parked out of the world
  const lamp = { x: 0, y: -999, z: 0, r: 7, k: 1, c: [2.2, 1.1, 0.4] };
  const inv = new THREE.Matrix4();
  const m = new THREE.Matrix4();
  const feetW = [V(0, 0, 0), V(0, 0, 0)], gripW = [V(0, 0, 0), V(0, 0, 0)];
  const qr = new THREE.Quaternion();
  // the hull creaks and the rigging works in a slow rhythm (the sound engine creaks once a half-turn)
  let phase = 0;
  // Sakura's sculling oar is gone: nothing cuts the water beside the hull
  const oarW = new THREE.Vector4(0, -99999, 0, -99999);
  const eddies = Array.from({ length: 8 }, () => new THREE.Vector4(0, -99999, -1e3, 0));
  // the bow's track, for the wake: [0] is the bow now, then a point every WAKE_STEP metres run (x, z, time, odometer)
  const WAKE_STEP = 4.5, BOW_Z = HULL.z0 + HULL.len;
  const wake = Array.from({ length: 16 }, () => new THREE.Vector4(0, -99999, -1e3, 0));
  let odo = 0;

  // pose: x, z, heading (radians, 0 = -z), speed m/s, lean (steering), steer (the helm, -1..1)
  function update(dt, t, pose) {
    phase += dt * (0.45 + Math.min(pose.speed, 8) * 0.08);
    furl.value = 1 - (pose.sail ?? 1);
    // the shadow pass draws the cloth unfurled: once it is mostly gathered up it casts none
    parts.sail.traverse((o) => { if (o.isMesh) o.castShadow = furl.value < 0.6; });
    const bob = Math.sin(t * 1.3) * 0.025 + Math.sin(t * 2.1 + 1.0) * 0.012;
    root.position.set(pose.x, bob, pose.z);
    root.rotation.set(Math.sin(t * 1.1 + 0.6) * 0.012 - pose.speed * 0.002, pose.heading, Math.sin(t * 0.9) * 0.02 + pose.lean * 0.06, 'YXZ');
    // the rudder follows the helm: putting her to starboard (D) swings the tiller to port, the blade to starboard
    rudder += ((pose.steer || 0) * RUDDER_MAX - rudder) * (1 - Math.exp(-dt * 3.5));
    hinge.quaternion.setFromAxisAngle(axis, rudder);
    root.updateMatrixWorld(true);

    // he sits easy, swaying a little with the boat, watching the channel ahead and the banks either side
    for (let i = 0; i < 2; i++) root.localToWorld(feetW[i].copy(FEET[i]));
    grip.getWorldPosition(gripW[0]);
    root.localToWorld(gripW[1].copy(KNEE_L));
    root.getWorldQuaternion(qr);
    man.pose({
      shift: 0.02 * Math.sin(t * 0.7), dip: 0, lean: 0.22 + 0.03 * Math.sin(t * 0.5), turn: 0.06 * Math.sin(t * 0.21),
      grips: gripW, hands: qr, feet: feetW,
      look: [0.05 + 0.04 * Math.sin(t * 0.4), 0.45 * Math.sin(t * 0.13) + 0.15 * Math.sin(t * 0.31), 0],
    });

    odo += pose.speed * dt;
    const bx = pose.x + Math.sin(pose.heading) * BOW_Z, bz = pose.z + Math.cos(pose.heading) * BOW_Z;
    if (Math.hypot(bx - wake[1].x, bz - wake[1].y) > WAKE_STEP * 4) {
      // a jump to another stretch of river leaves no track behind
      for (const w of wake) w.set(bx, bz, t - 1e3, odo);
    } else if (odo - wake[1].w >= WAKE_STEP) {
      for (let i = wake.length - 1; i > 1; i--) wake[i].copy(wake[i - 1]);
      wake[1].set(bx, bz, t, odo);
    }
    wake[0].set(bx, bz, t, odo);

    // the water reads the hull: wake, hull ring, discard inside
    m.makeRotationY(pose.heading).setPosition(pose.x, 0, pose.z);
    inv.copy(m).invert();
    U.uBoat.value.set(pose.x, pose.z, pose.heading, pose.speed / 4);
  }

  // the seat camera: a passenger sitting on the floor amidships, looking ahead past the mast
  const seat = { z: 0.9, y: deckAt(0.9) + 0.95 };
  function seatView() {}

  // the full tier has its own geometry as well as its textures, and meshopt keeps each tier's dequantisation in its
  // node transforms: the hull, sail and rudder nodes are swapped whole, with the same boat material on the incoming ones
  let parts = { hull: hullNode, sail: sailNode, rudder: rudderNode };
  function upgrade(hi, aniso) {
    const next = { hull: hi.getObjectByName('hull'), sail: hi.getObjectByName('sail'), rudder: hi.getObjectByName('rudder') };
    if (!next.hull || !next.sail || !next.rudder) throw new Error('boat: the full tier lacks its hull, sail or rudder');
    hi.traverse((o) => { if (o.isMesh) for (const slot of SLOTS) if (o.material[slot]) o.material[slot].anisotropy = aniso; });
    for (const k of ['hull', 'sail', 'rudder']) {
      const old = parts[k], into = k === 'rudder' ? hung : root;
      next[k].visible = old.visible;
      into.remove(old);
      into.add(next[k]);
      prepare(next[k], k === 'sail' ? furl : null);
      old.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        for (const slot of SLOTS) o.material[slot]?.dispose();
      });
    }
    parts = next;
  }

  return { root, update, upgrade, inv, lamp, oarW, eddies, wake, seatView, seat, get sail() { return parts.sail; }, get phase() { return phase; }, get rudder() { return rudder; } };
}
