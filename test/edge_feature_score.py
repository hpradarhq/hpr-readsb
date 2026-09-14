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
    'live_transport': has('hpr/edge/ui/airwire-adapter.js', 'new WebSocket', '0x0A', "binaryType='arraybuffer'")
                      and has('hpr/airwire/AIRWIRE-BINARY-V1.md', '/ws/air', '0x0A'),
    'map_visual': has('hpr/edge/ui/aircraft-renderer.js', 'hpr-cf-fe', 'No clustering', 'no LOD')
                  and has('hpr/edge/ui/edge-ui-patch.js', 'Suppress the green/aging/stale ring', 'Planespotters.net')
                  and has('hpr/edge/ui/edge-e1e7.js', 'aircraft-selected-emphasis'),
    'search_filter_sort': has('hpr/edge/ui/edge-ops.js', 'hprType', 'hprAltMin', 'hprSource', 'hprSort')
                          and has('hpr/edge/ui/edge-e1e7.js', 'hprCountry', 'hprSquawk', 'military', 'Emergency'),
    'detail_enrichment': has('hpr/edge/ui/edge-ui-patch.js', 'Country', '/api/photo/hex/')
                         and has('hpr/edge/ui/airwire-adapter.js', 'typeCode', 'registration')
                         and has('hpr/edge/ui/edge-e1e7.js', 'Follow', 'Trace', 'Replay'),
    'tracks_history': has('hpr/edge/ui/edge-history.js', 'trace_${kind}_', 'hprTimeline', 'hprTraceGraph', 'hpr:history:replay')
                      and has('hpr/edge/ui/edge-ops.js', 'hpr-all-tracks', 'trace_recent_'),
    'coverage': has('hpr/edge/ui/edge-ops.js', 'hpr-range-rings', 'outline.json', 'actualRange'),
    'station_ops': has('hpr/edge/ui/edge-ops.js', 'EDGE HEALTH', 'AirWire', 'Dropped', 'Uptime')
                   and has('hpr/edge/ui/edge-e1e7.js', 'Tracked', 'edgeCapacity'),
    'mobile': has('hpr/edge/ui/index.html', '@media(max-width:680px)', 'compositionMode')
              and has('hpr/edge/ui/edge-history.js', '@media(max-width:680px)'),
    'deployment': has('docker/edge.Dockerfile', '4.8.0-edge.1', 'readsb', 'nginx', 'hpr-edge')
                  and has('deploy/compose.pi.yml', 'hpr-readsb-edge'),
    'e7_benchmark': has('hpr/edge/ui/edge-benchmark.js', 'E7 BENCHMARK', 'find_aircraft', 'coverage')
                    and has('test/e7_compare.py', 'COMPOSITE', 'target >=130'),
}

# Static contract score only. This is NOT the real E7 result; real E7 requires
# same-Pi comparative exports and test/e7_compare.py.
weights = {
    'live_transport': 25,
    'map_visual': 16,
    'search_filter_sort': 14,
    'detail_enrichment': 13,
    'tracks_history': 15,
    'coverage': 10,
    'station_ops': 14,
    'mobile': 7,
    'deployment': 8,
    'e7_benchmark': 10,
}
score = sum(weights[k] for k, ok in checks.items() if ok)
threshold = 130
print('HPR Edge static capability contract (NOT real E7 benchmark)')
for k in weights:
    print(f"  {k:20s} {'PASS' if checks[k] else 'FAIL':4s} {weights[k] if checks[k] else 0:>3}")
print(f'TOTAL={score} STATIC_TARGET={threshold}')
if not all(checks.values()):
    print('Missing mandatory capability:', ', '.join(k for k,v in checks.items() if not v), file=sys.stderr)
if score < threshold or not all(checks.values()):
    sys.exit(1)
