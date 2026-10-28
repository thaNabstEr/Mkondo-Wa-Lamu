// Where everything built stands. A site registers a pad (layout.js addPad) to flatten the terrain before it is
// generated, and a blocker here to keep trees and grass out of it. The channel has nothing built on it yet: piers,
// lodges and fence traps come in later phases.

export const SITES = {};

// blockers: circles (x, z, r) no vegetation may enter
export const BLOCK = [];

export function blocked(x, z, margin = 0) {
  for (let i = 0; i < BLOCK.length; i++) {
    const b = BLOCK[i];
    const dx = x - b.x, dz = z - b.z, r = b.r + margin;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}
