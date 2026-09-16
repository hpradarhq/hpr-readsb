'use strict';
// G23 / P3: interaction & data parity. Altitude filter, follow/lock, station
// distance/bearing and the altitude-trend sparkline.
const { test, expect, chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../hpr/edge/ui');
let server, baseURL;

function frame(n, bump, alt) {
  const out = Buffer.alloc(n * 35); let o = 0;
  for (let i = 0; i < n; i++) {
    const id = 0x888000 + i, cs = `H${String(i).padStart(6, '0')}`;
    const a = alt ? alt(i) : 10000 + i * 5000;
    out[o] = 0x02; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    out.writeInt32LE(Math.round((106.0 + i * .02 + bump * .002) * 600000), o + 4);
    out.writeInt32LE(Math.round((20.0 + i * .02) * 600000), o + 8);
    out.writeInt16LE(Math.round(a / 25), o + 12);
    out.writeUInt16LE(900, o + 14); out.writeUInt16LE(3000, o + 16); out.writeInt16LE(0, o + 18);
    o += 20;
    out[o] = 0x06; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    Buffer.from(cs.padEnd(8, ' '), 'ascii').copy(out, o + 4); out[o + 12] = 0xa3; out.writeUInt16LE(0x1200, o + 13); o += 15;
  }
  return [...out];
}
function mime(f) { return f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream'; }
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/api/readsb/receiver.json') return void res.end(JSON.stringify({ lat: 20.844, lon: 106.688, version: '3.16.16' }));
    if (u.pathname === '/api/readsb/station.json') return void res.end(JSON.stringify({ name: 'HPR', lat: 20.844, lon: 106.688 }));
    if (u.pathname === '/data/stats.json') return void res.end('{}');
    if (u.pathname.startsWith('/api/traffic/') || u.pathname.startsWith('/api/photo/')) { res.statusCode = 503; return void res.end('{}'); }
    let rel = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\//, '');
    const f = path.resolve(ROOT, rel);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.statusCode = 404; return void res.end('not found'); }
    let body = fs.readFileSync(f);
    if (rel === 'index.html') body = Buffer.from(body.toString('utf8').replace('</head>', '<script src="/hpr-config.js"></script>\n<script src="/edge-g20a-aircraft-lod.js"></script>\n</head>'));
    res.setHeader('content-type', mime(f)); res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r)); baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(r => server.close(r)); });

test('G23 altitude filter, follow, distance/bearing and sparkline', async () => {
  test.setTimeout(90000);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require.resolve('maplibre-gl'), 'utf8') }));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(path.dirname(require.resolve('maplibre-gl')), 'maplibre-gl.css'), 'utf8') }));
  await page.route('https://tiles.openfreemap.org/sprites/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
  const frames = [0, 1, 2, 3].map(b => frame(3, b));
  await page.addInitScript(({ frames }) => {
    let current = null;
    class W { constructor() { current = this; this.binaryType = 'arraybuffer'; setTimeout(() => { this.onopen && this.onopen({}); setTimeout(() => this.onmessage && this.onmessage({ data: new Uint8Array(frames[0]).buffer }), 5); }, 5); } close() { this.onclose && this.onclose({}); } send() { } }
    globalThis.WebSocket = W;
    globalThis.__hprFeed = (k) => { if (current && current.onmessage) current.onmessage({ data: new Uint8Array(frames[k % frames.length]).buffer }); };
  }, { frames });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.HPRAirWire && globalThis.HPRAirWire.stats().aircraft), { timeout: 20000 }).toBe(3);
  await expect.poll(() => page.locator('#airList .row').count(), { timeout: 20000 }).toBe(3);

  // altitude filter: aircraft at 10k/15k/20k; "High" (>=25k) hides all.
  await page.locator('#altFilter button[data-alt="high"]').click();
  await expect.poll(() => page.locator('#airList .row').count()).toBe(0);
  expect(await page.evaluate(() => globalThis.__hprFE.state().filterAlt)).toBe('high');
  await page.locator('#altFilter button[data-alt="all"]').click();
  await expect.poll(() => page.locator('#airList .row').count()).toBe(3);

  // select first -> distance/bearing + follow button + sparkline after history.
  await page.locator('#airList .row').first().click();
  await expect(page.locator('#detail')).toHaveClass(/open/);
  await expect(page.locator('#detail')).toContainText('Distance');
  await expect.poll(() => page.locator('#detail').textContent(), { timeout: 8000 }).toContain('nm');
  await expect(page.locator('#followBtn')).toBeVisible();
  await page.locator('#followBtn').click();
  expect(await page.evaluate(() => globalThis.__hprFE.state().follow)).toBe(true);
  // feed moved frames to build altitude history, then expect a sparkline
  for (let i = 0; i < 4; i++) { await page.evaluate(k => globalThis.__hprFeed(k), i); await page.waitForTimeout(120); }
  await expect.poll(() => page.evaluate(() => !!document.querySelector('.hpr-spark')), { timeout: 8000 }).toBe(true);
  expect(errors).toEqual([]);
  await browser.close();
});
