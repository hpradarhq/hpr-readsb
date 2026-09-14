window.HPR_CONFIG = {
  ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/air`,
  zstd: false
};

document.write('<link rel="stylesheet" href="/edge-g1-list.css">');
document.write('<script src="/edge-g3-map.js"><\/script>');
