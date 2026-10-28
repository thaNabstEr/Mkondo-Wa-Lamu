// How fast the browser runs requestAnimationFrame on a blank page, with the same Chrome and flags as perf.mjs: a
// check that a slow measurement is the scene and not the machine (low-power mode, a 30 Hz display, throttling).
// usage: node scripts/tools/raf.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
const page = await (await browser.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await page.setContent('<body style="margin:0;background:#123"></body>');
const r = await page.evaluate(() => new Promise((res) => {
  const t = []; let last = performance.now();
  const f = (n) => { t.push(n - last); last = n; if (t.length < 180) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res({ p50: +t[90].toFixed(2), fps: +(1000 / t[90]).toFixed(1) }); } };
  requestAnimationFrame(f);
}));
console.log(JSON.stringify(r));
await browser.close();
