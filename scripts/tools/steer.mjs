// Drives the controls in the running app and checks the results: steering into a bank and onto a sandbar must
// bump (and never leave the hull aground), lowering the sail must slow the boat, and the rudder must follow the helm
// (D: positive, the tiller to port; A: negative).
// usage: node scripts/tools/steer.mjs
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5190/?z=-860&tier=lo', { waitUntil: 'load' });
await page.waitForFunction(() => window.__sf, null, { timeout: 90000 });
await page.waitForTimeout(3000);
await page.evaluate(() => {
  const j = window.__sf.journey;
  window.__bumps = [];
  const prev = j.onBump;
  j.onBump = (k) => { window.__bumps.push(+k.toFixed(2)); prev && prev(k); };
  // the worst grounding seen each frame, sampled as the boat moves
  window.__worst = -9;
  const upd = j.update.bind(j);
  j.update = (dt) => {
    const p = upd(dt);
    const c = j.sample(j.s, {});
    const g = j.aground(c, j.lat, p.heading);
    if (g) window.__worst = Math.max(window.__worst, g.depth);
    return p;
  };
});
const out = {};
const state = () => page.evaluate(() => { const j = window.__sf.journey; return { rudder: +window.__sf.boat.rudder.toFixed(2), z: +j.pose.z.toFixed(1), lat: +j.lat.toFixed(2), speed: +j.speed.toFixed(2), sail: +j.sail.toFixed(2), bumps: window.__bumps.length, worst: +window.__worst.toFixed(3) }; });
const hold = async (key, ms, during) => {
  await page.keyboard.down(key); await page.waitForTimeout(ms);
  if (during) out[during] = await state();
  await page.keyboard.up(key);
};
out.start = await state();
await hold('KeyD', 4000, 'helmD');
out.creekRight = await state();
await hold('KeyA', 6000, 'helmA');
out.creekLeft = await state();
await hold('KeyS', 3500);
await page.waitForTimeout(4000);
out.sailDown = await state();
await hold('KeyW', 3000);
await page.waitForTimeout(4000);
out.sailUp = await state();
// the first sandbar, at z -300 on the inside of the bend (the +x side)
await page.evaluate(() => { const j = window.__sf.journey; j.jump(j.sAtZ(-250)); window.__bumps = []; window.__worst = -9; });
await page.waitForTimeout(1000);
await hold('KeyD', 9000);
out.sandbar = await state();
console.log(JSON.stringify({ ...out, errors }, null, 1));
await browser.close();
