window.HPR_CONFIG = {
  ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/air`,
  zstd: false,
  edgeCapacity: 400,
  trafficApi: '/api/traffic',
  opsProfile: 'fr24-airnav-tar1090'
};

document.write('<script src="/edge-calm-ui.js"><\/script>');
document.write('<script src="/edge-ops.js"><\/script>');
document.write('<script src="/edge-trace-policy.js"><\/script>');
document.write('<script src="/edge-e1e7.js"><\/script>');
document.write('<script src="/edge-enrich.js"><\/script>');
document.write('<script src="/edge-traffic-enrich.js"><\/script>');
document.write('<script src="/edge-detail-cards.js"><\/script>');
document.write('<script src="/edge-map-policy.js"><\/script>');
document.write('<script src="/edge-admin-ui.js"><\/script>');
if (new URLSearchParams(location.search).get('bench') === '1') {
  document.write('<script src="/edge-benchmark.js"><\/script>');
}
document.addEventListener('DOMContentLoaded', () => {
  const build = document.querySelector('.build');
  if (build) build.textContent = 'FE 4.8.4-edge.1 · E7+';
}, { once: true });