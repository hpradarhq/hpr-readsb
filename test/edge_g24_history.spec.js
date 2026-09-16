'use strict';
// G24 / P4: playback & history surfaces. Station coverage dashboard and
// GeoJSON trace export from the selected aircraft.
const { test, expect, chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../hpr/edge/ui');
let server, baseURL;

function frame(n) {
  const out = Buffer.alloc(n * 35); let o = 0;
  for (let i = 0; i < n; i++) {
    const id = 0x888000 + i, cs = `H${String(i).padStart(6, '0')}`;
    out[o] = 0x02; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    out.writeInt32LE(Math.round((106.0 + i * .05) * 600000), o + 4);
    out.writeInt32LE(Math.round((20.0 + i * .05) * 600000), o + 8);
    out.writeInt16LE(400, o + 12); out.writeUInt16LE(900, o + 14); out.writeUInt16LE(2500, o + 16); out.writeInt16LE(0, o + 18);
    o += 20;
    out[o] = 0x06; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    Buffer.from(cs.padEnd(8, ' '), 'ascii').copy(out, o + 4); out[o + 12] = 0xa3; out.writeUInt16LE(0x1200, o + 13); o += 15;
  }
  return [...out];
}
function traceJson() { const base = Math.floor(Date.now() / 1000) - 600, pts = []; for (let i = 0; i < 30; i++) pts.push([i * 5, 20.0 + i * .001, 106.0 + i * .001, 10000 + i * 30, 240, 90, 0, 0]); return JSON.stringify({ timestamp: base, trace: pts }); }
function mime(f) { return f.endsWith('.js') ? 'application/javascript' : f.endsWith('.css') ? 'text/css' : f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream'; }
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    if (u.pathname === '/api/readsb/receiver.json') return void res.end(JSON.stringify({ lat: 20.844, lon: 106.688, version: '3.16.16' }));
    if (u.pathname === '/api/readsb/station.json') return void res.end(JSON.stringify({ name: 'HPR', lat: 20.844, lon: 106.688 }));
    if (u.pathname === '/data/stats.json') return void res.end('{}');
    if (u.pathname.startsWith('/data/traces/')) { res.setHeader('content-type', 'application/json'); return void res.end(traceJson()); }
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

test('G24 station coverage dashboard and trace export', async () => {
  test.setTimeout(90000);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require.resolve('maplibre-gl'), 'utf8') }));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(path.dirname(require.resolve('maplibre-gl')), 'maplibre-gl.css'), 'utf8') }));
  await page.route('https://tiles.openfreemap.org/sprites/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
  const bytes = frame(2);
  await page.addInitScript((bytes) => { let c = null; class W { constructor() { c = this; this.binaryType = 'arraybuffer'; setTimeout(() => { this.onopen && this.onopen({}); setTimeout(() => this.onmessage && this.onmessage({ data: new Uint8Array(bytes).buffer }), 5); }, 5); } close() { } send() { } } globalThis.WebSocket = W; }, bytes);
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.locator('#airList .row').count(), { timeout: 20000 }).toBe(2);

  // coverage dashboard
  await page.locator('#receiverBtn').click();
  await expect(page.locator('#detail')).toContainText('Coverage');
  await expect(page.locator('#detail')).toContainText('Max range');
  await expect.poll(() => page.locator('#detail').textContent(), { timeout: 8000 }).toContain('nm');

  // select an aircraft, wait for its trace, export it
  await page.locator('#airList .row').first().click();
  await expect.poll(() => page.evaluate(() => (globalThis.HPREdgeTrace.geojson().features || []).length), { timeout: 10000 }).toBeGreaterThan(0);
  await expect(page.locator('.hpr-trace-export')).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }), page.locator('.hpr-trace-export').click()]);
  expect(download.suggestedFilename()).toMatch(/^trace_.*\.geojson$/);
  expect(errors).toEqual([]);
  await browser.close();
});
