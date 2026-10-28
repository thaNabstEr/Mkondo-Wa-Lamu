// Smoke test: boots the app, reports every console error and page error (also when it never finishes booting),
// visits stretches of the journey, then sails off the end of the route and waits for the next lap to start.
// usage: node scripts/tools/smoke.mjs [url]
import { chromium } from 'playwright-core';

const url = process.argv[2] || 'http://127.0.0.1:5190/?z=0';
const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--window-size=1280,800'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const done = async (ok, note) => {
  console.log(JSON.stringify({ ok: ok && !errors.some((e) => e.startsWith('pageerror') || e.startsWith('error')), note, errors }, null, 1));
  await browser.close();
  process.exit(0);
};

await page.goto(url, { waitUntil: 'load' });
try {
  await page.waitForFunction(() => window.__sf, null, { timeout: 90000 });
} catch {
  await done(false, 'never booted');
}
await page.waitForTimeout(4000);
const total = await page.evaluate(() => window.__sf.journey.total);
for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
  await page.evaluate((f) => { const j = window.__sf.journey; j.s = j.total * f; }, f);
  await page.waitForTimeout(1500);
}
// to the end of the route: the lap ends, the next one begins
await page.evaluate(() => { const j = window.__sf.journey; j.s = j.total - 5; j.target = j.cruise; });
try {
  await page.waitForFunction(() => window.__sf.journey.loop > 0, null, { timeout: 60000 });
  await page.waitForTimeout(4000);
  await done(true, `route ${total.toFixed(0)} m; lap turned over`);
} catch {
  await done(false, `route ${total.toFixed(0)} m; lap did not turn over within 60 s`);
}
