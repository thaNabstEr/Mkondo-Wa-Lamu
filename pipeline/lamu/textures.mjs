// Textures made for the dhow, written to .cache/build/ for dhow.py:
//   emblem.png    the Lamu eye (Context/Image References/emblem.png, our own artwork), cut to its outer ring
//   bowboard.png  the bow board: an original design in the Lamu manner (blue board, white medallion scrollwork,
//                 a white band beneath, a red stripe). Drawn here from simple shapes; nothing is traced from the
//                 reference photographs.
// usage (from the repository root): node pipeline/lamu/textures.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sharp = createRequire(new URL('../node/', import.meta.url))('sharp');
const OUT = fileURLToPath(new URL('../../.cache/build/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// ---- the Lamu eye: the artwork's white ground outside the red ring becomes transparent
{
  const S = 1024;
  const mask = Buffer.from(`<svg width="${S}" height="${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${S / 2 - 3}" fill="#fff"/></svg>`);
  const rgb = await sharp(fileURLToPath(new URL('../../Context/Image References/emblem.png', import.meta.url)))
    .resize(S, S, { fit: 'fill' }).removeAlpha().toBuffer();
  const alpha = await sharp(mask).resize(S, S).extractChannel(0).toBuffer();
  await sharp(rgb).joinChannel(alpha).png().toFile(OUT + 'emblem.png');
}

// ---- the bow board, 2048 x 512: u runs from the stem aft, v from the sheer down
{
  const W = 2048, H = 512;
  const BLUE = '#1d4f9c', WHITE = '#f3efe4', RED = '#c3271f';
  const board = 0.70 * H; // blue field; then the white band, then the red stripe
  const band = 0.10 * H, stripe = 0.20 * H;
  const cy = board / 2 + 6, R = board * 0.36;
  const parts = [];
  // a medallion: a ring, four petals turned to the diagonals around a small square, dots between them
  const medallion = (cx) => {
    const p = [];
    p.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${WHITE}" stroke-width="${R * 0.13}"/>`);
    p.push(`<circle cx="${cx}" cy="${cy}" r="${R * 0.74}" fill="none" stroke="${WHITE}" stroke-width="${R * 0.05}"/>`);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const ex = cx + Math.cos(a) * R * 0.38, ey = cy + Math.sin(a) * R * 0.38;
      p.push(`<ellipse cx="${ex}" cy="${ey}" rx="${R * 0.28}" ry="${R * 0.12}" transform="rotate(${(a * 180) / Math.PI} ${ex} ${ey})" fill="${WHITE}"/>`);
      const b = (k * Math.PI) / 2;
      p.push(`<circle cx="${cx + Math.cos(b) * R * 0.5}" cy="${cy + Math.sin(b) * R * 0.5}" r="${R * 0.07}" fill="${WHITE}"/>`);
    }
    p.push(`<rect x="${cx - R * 0.13}" y="${cy - R * 0.13}" width="${R * 0.26}" height="${R * 0.26}" transform="rotate(45 ${cx} ${cy})" fill="${WHITE}"/>`);
    p.push(`<rect x="${cx - R * 0.06}" y="${cy - R * 0.06}" width="${R * 0.12}" height="${R * 0.12}" transform="rotate(45 ${cx} ${cy})" fill="${BLUE}"/>`);
    return p.join('');
  };
  // between two medallions, a running vine: an S-curve from one ring to the next that curls in on itself at either
  // end, with a leaf off each bow of the S
  const scroll = (cx, gap) => {
    const x0 = cx - gap / 2, x1 = cx + gap / 2, a = R * 0.6, sw = R * 0.1;
    const curl = (x, y, dir, up) => {
      const r = R * 0.16;
      return `<path d="M ${x} ${y} C ${x + dir * r * 1.6} ${y}, ${x + dir * r * 1.9} ${y + up * r * 1.6}, ${x + dir * r * 0.9} ${y + up * r * 1.5} C ${x + dir * r * 0.2} ${y + up * r * 1.4}, ${x + dir * r * 0.3} ${y + up * r * 0.7}, ${x + dir * r * 0.9} ${y + up * r * 0.8}" fill="none" stroke="${WHITE}" stroke-width="${sw * 0.8}" stroke-linecap="round"/>`;
    };
    const leaf = (x, y, ang) => `<ellipse cx="${x}" cy="${y}" rx="${R * 0.17}" ry="${R * 0.06}" transform="rotate(${ang} ${x} ${y})" fill="${WHITE}"/>`;
    return [
      `<path d="M ${x0} ${cy} C ${x0 + gap * 0.3} ${cy - a * 1.6}, ${x1 - gap * 0.3} ${cy + a * 1.6}, ${x1} ${cy}" fill="none" stroke="${WHITE}" stroke-width="${sw}" stroke-linecap="round"/>`,
      curl(cx - gap * 0.12, cy - a * 0.55, -1, -1),
      curl(cx + gap * 0.12, cy + a * 0.55, 1, 1),
      leaf(cx - gap * 0.22, cy + a * 0.05, 35),
      leaf(cx + gap * 0.22, cy - a * 0.05, 35),
    ].join('');
  };
  const pitch = R * 4.0;
  let n = 0;
  for (let cx = R * 1.5; cx < W - R; cx += pitch, n++) {
    parts.push(medallion(cx));
    if (cx + pitch < W - R * 0.5) parts.push(scroll(cx + pitch / 2, pitch - 2 * R - R * 0.13));
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${BLUE}"/>
    ${parts.join('\n')}
    <rect y="${board}" width="${W}" height="${band}" fill="${WHITE}"/>
    <rect y="${board + band}" width="${W}" height="${stripe}" fill="${RED}"/>
  </svg>`;
  // a little weathering: paint is brushed on, not printed
  const grain = await sharp({ create: { width: W / 4, height: H / 4, channels: 1, noise: { type: 'gaussian', mean: 128, sigma: 22 } } })
    .resize(W, H, { kernel: 'cubic' }).toColourspace('b-w').png().toBuffer();
  await sharp(Buffer.from(svg)).composite([{ input: grain, blend: 'soft-light' }]).removeAlpha().png().toFile(OUT + 'bowboard.png');
  console.log('bow board', n, 'medallions');
}
console.log('textures ->', OUT);
