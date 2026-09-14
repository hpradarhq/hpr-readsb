window.HPR_CONFIG = {
  ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/air`,
  zstd: false,
  trafficApi: '/api/traffic',
  photoApi: '/api/photo/hex'
};

document.write('<link rel="stylesheet" href="/edge-g1-list.css">');
document.write('<script src="/edge-g3-map.js"><\/script>');
document.write('<script src="/edge-g4-calm-list.js"><\/script>');
document.write('<script src="/edge-g5-detail.js"><\/script>');
document.write('<script src="/edge-g6-detail-layout.js"><\/script>');
document.write('<script src="/edge-g7-enrich.js"><\/script>');
