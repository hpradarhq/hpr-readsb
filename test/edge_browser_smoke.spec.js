'use strict';

const { test, expect, chromium } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../hpr/edge/ui');

function airwireFrame() {
  const out = Buffer.alloc(35);
  const id = 0x888001;
  out[0] = 0x02;
  out[1] = id & 0xff; out[2] = (id >> 8) & 0xff; out[3] = (id >> 16) & 0xff;
  out.writeInt32LE(Math.round(106.688 * 600000), 4);
  out.writeInt32LE(Math.round(20.844 * 600000), 8);
  out.writeInt16LE(Math.round(12500 / 25), 12);
  out.writeUInt16LE(Math.round(92.5 * 10), 14);
  out.writeUInt16LE(Math.round(245.0 * 10), 16);
  out.writeInt16LE(640, 18);
  out[20] = 0x06;
  out[21] = id & 0xff; out[22] = (id >> 8) & 0xff; out[23] = (id >> 16) & 0xff;
  Buffer.from('HPR123  ', 'ascii').copy(out, 24, 0, 8);
  out[32] = 0xa3;
  out.writeUInt16LE(0x1200, 33);
  return [...out];
}

const MAPLIBRE_STUB = `(()=>{
  class Bounds { extend(){ return this; } }
  class Map {
    constructor(opts){ this.opts=opts; this.sources=new globalThis.Map(); this.layers=new globalThis.Map(); this.images=new Set(); this.handlers={}; this.zoom=opts.zoom||6; setTimeout(()=>this.emit('load'),0); }
    on(ev,a,b){ const fn=typeof a==='function'?a:b; (this.handlers[ev]||(this.handlers[ev]=[])).push(fn); return this; }
    once(ev,fn){ const wrap=(...args)=>{ this.off(ev,wrap); fn(...args); }; return this.on(ev,wrap); }
    off(ev,fn){ this.handlers[ev]=(this.handlers[ev]||[]).filter(x=>x!==fn); }
    emit(ev,p={}){ for(const fn of [...(this.handlers[ev]||[])]) fn(p); }
    addControl(){ return this; }
    addSource(id,spec){ const source={data:spec.data,setData(data){this.data=data;}}; this.sources.set(id,source); }
    getSource(id){ return this.sources.get(id); }
    addLayer(layer){ this.layers.set(layer.id,layer); }
    getLayer(id){ return this.layers.get(id); }
    setLayoutProperty(){}
    setLayerZoomRange(){}
    hasImage(id){ return this.images.has(id); }
    addImage(id){ this.images.add(id); }
    getCanvas(){ return {style:{}}; }
    fitBounds(){}
    flyTo(opts){ if(opts?.zoom!=null) this.zoom=opts.zoom; }
    getZoom(){ return this.zoom; }
    setStyle(style){ this.style=style; this.sources.clear(); this.layers.clear(); this.images.clear(); setTimeout(()=>this.emit('style.load'),0); }
  }
  class Control {}
  globalThis.maplibregl={Map,LngLatBounds:Bounds,NavigationControl:Control,GlobeControl:Control,FullscreenControl:Control,AttributionControl:Control};
})();`;

function mime(file) {
  if (file.endsWith('.js')) return 'application/javascript';
  if (file.endsWith('.css')) return 'text/css';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

let server;
let baseURL;

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/readsb/receiver.json') return void res.end(JSON.stringify({lat:20.844,lon:106.688,version:'3.16.16'}));
    if (url.pathname === '/api/readsb/station.json') return void res.end(JSON.stringify({name:'HPR Test'}));
    if (url.pathname === '/data/stats.json') return void res.end('{}');
    let rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//,'');
    const file = path.resolve(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode=404; return void res.end('not found'); }
    let body = fs.readFileSync(file);
    if (rel === 'index.html') body = Buffer.from(body.toString('utf8').replace('</head>','<script src="/hpr-config.js"></script>\n</head>'));
    res.setHeader('content-type', mime(file)); res.end(body);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); });

test('Atlas Edge remains clickable and responsive', async () => {
  const executablePath = process.env.CHROME_BIN || '/usr/bin/google-chrome';
  const browser = await chromium.launch({headless:true, executablePath, args:['--no-sandbox']});
  const page = await browser.newPage();
  let crashed = false;
  const pageErrors = [];
  page.on('crash', () => { crashed = true; });
  page.on('pageerror', err => pageErrors.push(String(err)));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js', route => route.fulfill({status:200,contentType:'application/javascript',body:MAPLIBRE_STUB}));
  await page.route('https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css', route => route.fulfill({status:200,contentType:'text/css',body:''}));
  await page.addInitScript(bytes => {
    class FakeWebSocket {
      constructor(){ this.binaryType='arraybuffer'; setTimeout(()=>{ this.onopen?.({}); setTimeout(()=>this.onmessage?.({data:new Uint8Array(bytes).buffer}),5); },5); }
      close(){ this.onclose?.({}); }
      send(){}
    }
    globalThis.WebSocket = FakeWebSocket;
  }, airwireFrame());

  await page.goto(baseURL, {waitUntil:'domcontentloaded'});
  const row = page.locator('.row').first();
  await expect(row).toBeVisible({timeout:5000});
  await expect(page.locator('.row .plane-icon').first()).toBeHidden();

  const collection = page.locator('#collection');
  const beforeOpen = await collection.evaluate(el => el.classList.contains('open'));
  await page.locator('#airBtn').click();
  await expect.poll(() => collection.evaluate(el => el.classList.contains('open'))).toBe(!beforeOpen);
  await page.locator('#airBtn').click();
  if (!beforeOpen) await page.locator('#airBtn').click();

  for (let i=0; i<20; i++) {
    await row.click({timeout:1500});
    await expect(page.locator('#detail')).toHaveClass(/open/);
    await expect(page.locator('.detail-title b')).toContainText('HPR123');
    await page.locator('#closeDetail').click({timeout:1500});
    await expect(page.locator('#detail')).not.toHaveClass(/open/);
  }

  const themeBefore = await page.locator('html').getAttribute('data-theme');
  await page.locator('#themeBtn').click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).not.toBe(themeBefore);
  await row.click({timeout:1500});
  await expect(page.locator('#detail')).toHaveClass(/open/);

  const responsive = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(true))));
  expect(responsive).toBe(true);
  expect(crashed).toBe(false);
  expect(pageErrors).toEqual([]);
  await browser.close();
});
