# Atlas Edge FE PDCA backlog

Frozen baseline: `f1cadf921bebb2748fbc16a6e83c67fefa683630` (physical-good).
Test branch/tag: `redteam/edge-freeze-20260915` / `edge-v4.7.5-edge.rc8`.

## Backlog
G1-G20: completed automated gates.
G20A: aircraft renderer + LOD corrective gate.
G20B: map/display completeness regression.
G20C: station/admin/feed completeness regression.
G20D: full UX contract regression + 400-aircraft soak.
G21: RC only after full CI and arm64/armv7 publish; stable `edge` untouched
pending one final eyeball acceptance.

## PDCA: G21 rc1 physical freeze -> rc2

Plan
- rc1 (`121a0eb`) passed mocked CI but froze on the real Pi. Suspect the real
  AirWire -> browser/map update workload and the untested G20A layer patch.

Do
- Reproduce with real MapLibre in headless Chromium + sustained binary AirWire
  frames. Real MapLibre logs `layers.aircraft-symbol.layout.icon-size: Only one
  zoom-based "step" or "interpolate" subexpression may be used in an expression`
  and drops `aircraft-symbol`; the stub suites never see it.
- Fix G3's expression, G20A's font, the list formatter/SVG hot path, and the
  small G7/G17/G18/G20A visibility defects.

Check
- `edge_g21_real_map.spec.js` fails on rc1 and passes on rc2.
- The smoke + 400-aircraft soak stubs now validate expressions and load G20A.
- All 17 Chromium specs and all `edge_g*_gate.sh` static gates pass.

Act
- rc2 exposed a feeds-panel reload race (form reset while a save was in flight);
  the reload now refreshes only the feed rows.
- rc3/rc4 physical review: icons collided to a single silhouette, the status halo
  read as a green circle, controls slid with the detail card, traces/replay were
  not visible. Fixed icon overlap, transparent halo, pinned controls, trace live
  fallback and a faster replay default.
- Cut `4.7.5-edge.rc8`, push the branch and `edge-v4.7.5-edge.rc8` tag for the
  arm64/armv7 image build. Physical acceptance remains the only promotion gate.

PDCA: Plan -> Do smallest change -> Check automated gates -> Act only on PASS.
