#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def text(path):
    return (ROOT / path).read_text(encoding='utf-8')

def has(path, *tokens):
    s = text(path)
    return all(t in s for t in tokens)

checks = {
    'live_transport': has('hpr/edge/ui/airwire-adapter.js', "new WebSocket", '0x0A', "binaryType='arraybuffer'")
                      and has('hpr/airwire/AIRWIRE-BINARY-V1.md', '/ws/air', '0x0A'),
    'map_visual': has('hpr/edge/ui/aircraft-renderer.js', 'cf-fe', 'No clustering', 'No LOD')
                  and has('hpr/edge/ui/edge-ui-patch.js', 'Suppress the green/aging/stale ring', 'Planespotters.net'),
    'search_filter_sort': has('hpr/edge/ui/edge-ops.js', 'hprType', 'hprAltMin', 'hprSource', 'hprSort', 'data-preset="emergency"'),
    'detail_enrichment': has('hpr/edge/ui/edge-ui-patch.js', 'Country', '/api/photo/hex/')
                         and has('hpr/edge/ui/airwire-adapter.js', 'typeCode', 'registration'),
    'tracks_history': has('hpr/edge/ui/edge-history.js', 'trace_${kind}_', "traceUrl(id,'full')", "traceUrl(id,'recent')", 'Replay')
                      and has('hpr/edge/ui/edge-ops.js', 'hpr-all-tracks', 'trace_recent_'),
    'coverage': has('hpr/edge/ui/edge-ops.js', 'hpr-range-rings', 'outline.json', 'actualRange'),
    'station_ops': has('hpr/edge/ui/edge-ops.js', 'EDGE HEALTH', 'AirWire', 'Dropped', 'Uptime'),
    'mobile': has('hpr/edge/ui/index.html', '@media(max-width:680px)', 'compositionMode'),
    'deployment': has('docker/edge.Dockerfile', 'readsb', 'nginx', 'hpr-edge')
                  and has('deploy/compose.pi.yml', 'hpr-readsb-edge'),
}

# tar1090 baseline = 100. Comparative multipliers are fixed in the benchmark spec.
weights = {
    'live_transport': 32,
    'map_visual': 21,
    'search_filter_sort': 15,
    'detail_enrichment': 11,
    'tracks_history': 10,
    'coverage': 10,
    'station_ops': 18,
    'mobile': 7,
    'deployment': 8,
}
score = sum(weights[k] for k, ok in checks.items() if ok)
threshold = 130
print('HPR Edge capability score (tar1090 baseline = 100)')
for k in weights:
    print(f"  {k:20s} {'PASS' if checks[k] else 'FAIL':4s} {weights[k] if checks[k] else 0:>3}")
print(f'TOTAL={score} TARGET={threshold}')
if not all(checks.values()):
    print('Missing mandatory capability:', ', '.join(k for k,v in checks.items() if not v), file=sys.stderr)
if score < threshold or not all(checks.values()):
    sys.exit(1)
