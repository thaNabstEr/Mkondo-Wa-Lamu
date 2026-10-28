// Contact sheet of the fixed views: node scripts/tools/sheet.mjs <dir> [<dir2>] -> <dir>/sheet.jpg
// With two dirs, each row shows the same view from both (e.g. Sakura baseline | current).
import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// sharp is installed with the asset pipeline, in pipeline/node
const sharp = createRequire(new URL('../../pipeline/node/', import.meta.url))('sharp');

const dirs = process.argv.slice(2);
const names = readdirSync(dirs[0]).filter((f) => /^v\d.*\.png$/.test(f)).sort();
const W = 640, H = 360;
const tiles = [];
for (const [r, n] of names.entries()) {
  for (const [c, d] of dirs.entries()) {
    try {
      tiles.push({ input: await sharp(join(d, n)).resize(W, H).toBuffer(), left: c * W, top: r * H });
    } catch { /* view missing in this dir */ }
  }
}
const cols = dirs.length > 1 ? dirs.length : 2;
const layout = dirs.length > 1 ? tiles : tiles.map((t, i) => ({ ...t, left: (i % cols) * W, top: Math.floor(i / cols) * H }));
const rows = dirs.length > 1 ? names.length : Math.ceil(names.length / cols);
await sharp({ create: { width: cols * W, height: rows * H, channels: 3, background: '#000' } })
  .composite(layout).jpeg({ quality: 80 }).toFile(join(dirs.at(-1), 'sheet.jpg'));
console.log('sheet', join(dirs.at(-1), 'sheet.jpg'), names.length, 'views');
