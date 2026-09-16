'use strict';
// G21 real-load regression: production script set + REAL MapLibre + sustained
// binary AirWire frames. The mocked suites cannot see MapLibre style
// validation, which is how the G20A/G21 freeze (aircraft-symbol rejected by an
// invalid zoom expression) escaped CI. This test fails if that regresses.
const { test, expect, chromium } = require('@playwright/test');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.resolve(__dirname, '../hpr/edge/ui');

function maplibrePaths() {
  try {
    const pkg = require.resolve('maplibre-gl/package.json');
    const dist = path.join(path.dirname(pkg), 'dist');
    return { js: path.join(dist, 'maplibre-gl.js'), css: path.join(dist, 'maplibre-gl.css') };
  } catch (_) {
    return null;
  }
}
const ML = maplibrePaths();

function airwireFrame(n, bump) {
  const out = Buffer.alloc(n * 35); let o = 0;
  for (let i = 0; i < n; i++) {
    const id = 0x888000 + i, cs = `H${String(i).padStart(6, '0')}`;
    out[o] = 0x02; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    out.writeInt32LE(Math.round((106.0 + (i % 40) * .02 + bump * 0.0005) * 600000), o + 4);
    out.writeInt32LE(Math.round((20.0 + (i % 25) * .02 + bump * 0.0005) * 600000), o + 8);
    out.writeInt16LE(200 + (i % 120), o + 12);
    out.writeUInt16LE((i * 9 + bump) % 3600, o + 14);
    out.writeUInt16LE(1800 + (i % 220), o + 16);
    out.writeInt16LE(((i % 9) - 4) * 64, o + 18);
    o += 20;
    out[o] = 0x06; out[o + 1] = id & 255; out[o + 2] = (id >> 8) & 255; out[o + 3] = (id >> 16) & 255;
    Buffer.from(cs.padEnd(8, ' '), 'ascii').copy(out, o + 4);
    out[o + 12] = 0xa3; out.writeUInt16LE(0x1200, o + 13);
    o += 15;
  }
  return [...out];
}
function mime(f) {
  if (f.endsWith('.js')) return 'application/javascript';
  if (f.endsWith('.css')) return 'text/css';
  if (f.endsWith('.svg')) return 'image/svg+xml';
  if (f.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

let server, baseURL;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/readsb/receiver.json') return void res.end(JSON.stringify({ lat: 20.844, lon: 106.688, version: '3.16.16' }));
    if (url.pathname === '/api/readsb/station.json') return void res.end(JSON.stringify({ name: 'HPR Real' }));
    if (url.pathname === '/data/stats.json') return void res.end('{}');
    let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return void res.end('not found'); }
    let body = fs.readFileSync(file);
    // Production parity: the image injects hpr-config.js and edge-g20a-aircraft-lod.js.
    if (rel === 'index.html') body = Buffer.from(body.toString('utf8').replace('</head>', '<script src="/hpr-config.js"></script>\n<script src="/edge-g20a-aircraft-lod.js"></script>\n</head>'));
    res.setHeader('content-type', mime(file)); res.end(body);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise(r => server.close(r)); });

test('G21 real MapLibre accepts aircraft layers under sustained AirWire load', async () => {
  test.setTimeout(120000);
  if (!ML) { console.warn('maplibre-gl not installed; skipping real MapLibre regression'); test.skip(true, 'maplibre-gl not installed'); return; }

  const n = 400;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  let crashed = false; page.on('crash', () => { crashed = true; });

  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(ML.js, 'utf8') }));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', r => r.fulfill({ status: 200, contentType: 'text/css', body: fs.readFileSync(ML.css, 'utf8') }));
  await page.route('https://tiles.openfreemap.org/sprites/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('https://tiles.openfreemap.org/**', r => r.fulfill({ status: 200, contentType: 'application/x-protobuf', body: Buffer.alloc(0) }));

  const frames = [0, 1, 2, 3].map(b => airwireFrame(n, b));
  await page.addInitScript(({ frames }) => {
    let current = null;
    class W {
      constructor() { current = this; this.binaryType = 'arraybuffer'; setTimeout(() => { this.onopen && this.onopen({}); setTimeout(() => this.onmessage && this.onmessage({ data: new Uint8Array(frames[0]).buffer }), 5); }, 5); }
      close() { this.onclose && this.onclose({}); }
      send() { }
    }
    globalThis.WebSocket = W;
    globalThis.__hprFeed = (k) => { if (current && current.onmessage) current.onmessage({ data: new Uint8Array(frames[k % frames.length]).buffer }); };
  }, { frames });

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => globalThis.HPRAirWire && globalThis.HPRAirWire.stats().aircraft), { timeout: 30000 }).toBe(n);

  // Real MapLibre must accept every aircraft layer the production bundle builds.
  // (Live dead-reckoning setData keeps the source busy, so wait on the layer,
  // not on map.loaded().)
  await expect.poll(() => page.evaluate(() => !!(globalThis.HPREdgeMap && globalThis.HPREdgeMap.getLayer('aircraft-symbol'))), { timeout: 30000 }).toBe(true);
  const policy = await page.evaluate(() => {
    const m = globalThis.HPREdgeMap;
    const spec = id => (m.getStyle().layers || []).find(l => l.id === id) || {};
    const symbol = spec('aircraft-symbol'), halo = spec('aircraft-halo');
    return {
      symbol: !!m.getLayer('aircraft-symbol'), lod: !!m.getLayer('aircraft-lod-dot'), selected: !!m.getLayer('aircraft-selected-symbol'),
      label: !!m.getLayer('aircraft-label'), hit: !!m.getLayer('aircraft-hit'), trail: !!m.getLayer('hpr-live-trail'),
      iconOverlap: symbol.layout && symbol.layout['icon-allow-overlap'],
      haloStrokeOpacity: halo.paint && halo.paint['circle-stroke-opacity'],
    };
  });
  expect(policy).toEqual({ symbol: true, lod: true, selected: true, label: true, hit: true, trail: true, iconOverlap: true, haloStrokeOpacity: 0 });

  // P2: altitude-banded hpr-globe silhouette images must be registered.
  await expect.poll(() => page.evaluate(() => (globalThis.HPREdgeMap.listImages ? globalThis.HPREdgeMap.listImages() : []).some(n => n.indexOf('aircraft-') === 0)), { timeout: 15000 }).toBe(true);

  // Sustained real AirWire update workload: feed moving frames and stay interactive.
  for (let i = 0; i < 40; i++) {
    await page.evaluate(k => globalThis.__hprFeed(k), i);
    if (i % 10 === 0) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(true))));
  }
  await expect.poll(() => page.evaluate(() => globalThis.HPRAirWire.stats().aircraft)).toBe(n);
  await expect.poll(() => page.evaluate(() => !!globalThis.HPREdgeMap.getLayer('aircraft-symbol'))).toBe(true);

  // Selecting an aircraft must show a trace and must not move the map controls.
  await page.locator('#airList .row').first().click();
  await expect.poll(() => page.evaluate(() => !!globalThis.HPREdgeMap.getLayer('hpr-readsb-trace')), { timeout: 10000 }).toBe(true);
  const controls = await page.evaluate(() => {
    const r = document.querySelector('.maplibregl-ctrl-top-right').getBoundingClientRect();
    return { right: Math.round(r.right), width: window.innerWidth, detailOpen: document.getElementById('detail').classList.contains('open') };
  });
  expect(controls.detailOpen).toBe(true);
  expect(controls.right).toBeGreaterThanOrEqual(controls.width - 16);

  expect(crashed).toBe(false);
  expect(pageErrors).toEqual([]);
  await browser.close();
});
