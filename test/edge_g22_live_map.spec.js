'use strict';
// G22 / P1: smooth live map. With no new AirWire frames, aircraft positions must
// keep advancing along track/groundspeed (dead reckoning) and a live trail must
// be produced from the browser-side position history.
const { test, expect, chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../hpr/edge/ui');
let server, baseURL;

function frame(n, bump) {
  const out = Buffer.alloc(n * 35); let o = 0;
  for (let i = 0; i < n; i++) {
    const id = 0x888000 + i, cs = `H${String(i).padStart(6, '0')}`;
    out[o] = 0x02; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    out.writeInt32LE(Math.round((106.0 + bump * 0.002) * 600000), o + 4);
    out.writeInt32LE(Math.round(20.0 * 600000), o + 8);
    out.writeInt16LE(200, o + 12); out.writeUInt16LE(900, o + 14); out.writeUInt16LE(4000, o + 16); out.writeInt16LE(0, o + 18);
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
    if (u.pathname === '/api/readsb/station.json') return void res.end(JSON.stringify({ name: 'HPR' }));
    if (u.pathname === '/data/stats.json') return void res.end('{}');
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

test('G22 dead reckoning advances positions and builds live trails', async () => {
  test.setTimeout(90000);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(require.resolve('maplibre-gl'), 'utf8') }));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(path.join(path.dirname(require.resolve('maplibre-gl')), 'maplibre-gl.css'), 'utf8') }));
  await page.route('https://tiles.openfreemap.org/sprites/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));
  const frames = [0, 1, 2].map(b => frame(2, b));
  await page.addInitScript(({ frames }) => {
    let current = null;
    class W { constructor() { current = this; this.binaryType = 'arraybuffer'; setTimeout(() => { this.onopen && this.onopen({}); setTimeout(() => this.onmessage && this.onmessage({ data: new Uint8Array(frames[0]).buffer }), 5); }, 5); } close() { this.onclose && this.onclose({}); } send() { } }
    globalThis.WebSocket = W;
    globalThis.__hprFeed = (k) => { if (current && current.onmessage) current.onmessage({ data: new Uint8Array(frames[k % frames.length]).buffer }); };
  }, { frames });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.HPRAirWire && globalThis.HPRAirWire.stats().aircraft), { timeout: 20000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => globalThis.__hprFE && globalThis.__hprFE.state().envelope), { timeout: 20000 }).toBe(true);

  const read = () => page.evaluate(() => {
    const f = globalThis.__hprFE.fc();
    const feat = f.features.find(x => x.id === '888000');
    return { lon: feat.geometry.coordinates[0], lat: feat.geometry.coordinates[1], trail: globalThis.__hprFE.trailFC().features.length };
  });
  const t0 = await read();
  await page.waitForTimeout(1500);
  const t1 = await read();
  // track 90 deg, 400 kt: longitude must advance east; latitude stays.
  expect(t1.lon).toBeGreaterThan(t0.lon);
  expect(Math.abs(t1.lat - t0.lat)).toBeLessThan(0.001);
  expect(t1.lon - t0.lon).toBeLessThan(0.2); // sane, not a runaway

  // Feed a couple of moved frames so the trail has history.
  await page.evaluate(() => globalThis.__hprFeed(1));
  await page.waitForTimeout(200);
  await page.evaluate(() => globalThis.__hprFeed(2));
  await page.waitForTimeout(200);
  await expect.poll(() => page.evaluate(() => globalThis.__hprFE.trailFC().features.length), { timeout: 5000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await browser.close();
});
