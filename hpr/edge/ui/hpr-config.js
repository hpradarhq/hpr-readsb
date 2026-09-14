window.HPR_CONFIG = {
  ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/air`,
  zstd: false,
  edgeCapacity: 400,
  opsProfile: 'fr24-airnav-tar1090'
};

/* Loaded while <head> is still parsing so every layer registers before the
 * inline Atlas runtime creates the MapLibre instance. */
document.write('<script src="/edge-ops.js"><\/script>');
document.write('<script src="/edge-e1e7.js"><\/script>');
document.addEventListener('DOMContentLoaded', () => {
  const build = document.querySelector('.build');
  if (build) build.textContent = 'FE 4.8.0-edge.1 · E1-E7';
}, { once: true });
