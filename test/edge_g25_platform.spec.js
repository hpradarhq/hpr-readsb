'use strict';
// G25 / P5: platform. PWA manifest, watch list, emergency-squawk toast,
// perf HUD and EN/VN language toggle.
const { test, expect, chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../hpr/edge/ui');
let server, baseURL;

function frame() {
  const id = 0x888001, out = Buffer.alloc(35);
  out[0] = 0x02; out[1] = id & 255; out[2] = (id >> 8) & 255; out[3] = (id >> 16) & 255;
  out.writeInt32LE(Math.round(106.688 * 600000), 4); out.writeInt32LE(Math.round(20.844 * 600000), 8);
  out.writeInt16LE(400, 12); out.writeUInt16LE(900, 14); out.writeUInt16LE(2500, 16); out.writeInt16LE(0, 18);
  out[20] = 0x06; out[21] = id & 255; out[22] = (id >> 8) & 255; out[23] = (id >> 16) & 255;
  Buffer.from('HPR123  ', 'ascii').copy(out, 24, 0, 8); out[32] = 0xa3; out.writeUInt16LE(0x7700, 33);
  return [...out];
}
function mime(f) { return f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.html') ? 'text/html' : f.endsWith('.webmanifest') ? 'application/manifest+json' : 'application/octet-stream'; }
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

test('G25 PWA manifest, watch, emergency toast, perf HUD, EN/VN', async () => {
  test.setTimeout(90000);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require.resolve('maplibre-gl'), 'utf8') }));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(path.dirname(require.resolve('maplibre-gl')), 'maplibre-gl.css'), 'utf8') }));
  await page.route('https://tiles.openfreemap.org/sprites/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
  const bytes = frame();
  await page.addInitScript((bytes) => { let c = null; class W { constructor() { c = this; this.binaryType = 'arraybuffer'; setTimeout(() => { this.onopen && this.onopen({}); setTimeout(() => this.onmessage && this.onmessage({ data: new Uint8Array(bytes).buffer }), 5); }, 5); } close() { } send() { } } globalThis.WebSocket = W; }, bytes);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

  // PWA manifest link
  expect(await page.evaluate(() => !!document.querySelector('link[rel="manifest"]'))).toBe(true);

  // emergency squawk 7700 -> in-app danger toast
  await expect.poll(() => page.locator('.toast.danger').count(), { timeout: 10000 }).toBeGreaterThan(0);

  // watch the selected aircraft
  await expect.poll(() => page.locator('#airList .row').count(), { timeout: 15000 }).toBe(1);
  await page.locator('#airList .row').first().click();
  await page.locator('#watchBtn').click();
  expect((await page.evaluate(() => globalThis.__hprFE.state().watch)).length).toBe(1);

  // perf HUD toggle via Settings
  await page.locator('#settingsBtn').click();
  await page.locator('[data-pref="perfHud"]').setChecked(true, { force: true });
  await expect.poll(() => page.evaluate(() => globalThis.__hprFE.state().perfHud)).toBe(true);
  await expect.poll(() => page.locator('#perfHud').isVisible(), { timeout: 8000 }).toBe(true);

  // language toggle
  await page.locator('[data-pref="lang"]').selectOption('vn');
  await expect(page.locator('#airBtn span')).toHaveText('Máy bay');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('vi');

  expect(errors).toEqual([]);
  await browser.close();
});
