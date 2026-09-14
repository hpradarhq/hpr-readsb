window.HPR_CONFIG = {
  ws: `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/air`,
  zstd: false,
  edgeCapacity: 400,
  opsProfile: 'tar1090-plus30'
};

/* hpr-config is injected while <head> is still parsing; load the operator layer
 * synchronously so its DOMContentLoaded hook is always registered in time. */
document.write('<script src="/edge-ops.js"><\\/script>');
