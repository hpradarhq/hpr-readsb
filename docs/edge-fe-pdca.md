# Atlas Edge FE PDCA backlog

Frozen baseline: `f1cadf921bebb2748fbc16a6e83c67fefa683630` (physical-good).
Test branch/tag: `feat/edge-e1-e7-ux` / `edge-ux`.

## Backlog
G1-G20: completed automated gates.
G20A: aircraft renderer + LOD corrective gate.
G20B: map/display completeness regression.
G20C: station/admin/feed completeness regression.
G20D: full UX contract regression + 400-aircraft soak.
G21: RC only after full CI and arm64/armv7 `edge-ux` push; stable `edge` untouched pending one final eyeball acceptance.

PDCA: Plan → Do smallest change → Check automated gates → Act only on PASS.
