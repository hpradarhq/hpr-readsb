# G20A-D to G21 release candidate

Candidate: FE `4.7.5-edge.rc3`, build `260916.rc2`, branch `redteam/edge-freeze-20260915`.

Supersedes `4.7.5-edge.rc1` (`121a0eb`), which failed physical acceptance: real Pi
Edge FE froze while the mocked Chromium + synthetic 400-aircraft CI stayed green.
`rc2` carried the freeze fix but its tag run tripped a pre-existing feeds-panel
race; `rc3` adds the deterministic feeds reload below.

## Root cause (rc1)

- `edge-g3-map.js` built `aircraft-symbol.layout.icon-size` as
  `['case', selected, ['interpolate', ..., ['zoom'], ...], ['interpolate', ..., ['zoom'], ...]]`.
  Real MapLibre allows only one zoom-based `step`/`interpolate` per expression,
  so it rejected the whole `aircraft-symbol` layer. Aircraft silhouettes never
  rendered and the map appeared frozen.
- CI could not see this: the Chromium suites substitute a MapLibre stub that did
  not validate expressions, and the smoke gate even asserted the invalid `case`
  shape. `edge-g20a-aircraft-lod.js` was also never loaded by any test.
- G20A's icon fix was defeated because it wraps `addLayer` and then calls the
  captured G3 wrapper, which overwrote `icon-size` with the invalid expression.
- The list update hot path also called `toLocaleString(undefined, {...})` per row
  per tick (17% of sampled CPU) and generated full inline SVG markup for rows
  that G1 CSS hides, making the Pi UI janky under real load.

## Fix (rc2)

- `edge-g3-map.js`: single zoom `interpolate` with the selected/normal `case` at
  the stops.
- `edge-g20a-aircraft-lod.js`: explicit `text-font` for the LOD dot layer so it
  uses the font the style actually serves.
- `index.html`: fast integer/decimal formatter (no `toLocaleString`), no hidden
  list SVG generation, G20A layers included in the Layers visibility toggle,
  row handler scoped to `#airList`.
- `edge-g18-responsive.js`: close-sync uses the real `#closeList` (was
  `#closeCollection`) and delegates for the dynamic `#closeDetail`.
- `edge-g17-vn-labels.js`: deny filter no longer targets aircraft/hpr layers.
- `edge-g7-enrich.js`: bounded enrichment cache.
- `edge-g15-feeds.js`: reload refreshes only the feed rows, so an in-flight save
  no longer resets the preset/custom form state (was a CI-flaky UX race).

## Regression

- `test/edge_g21_real_map.spec.js`: production script set + real MapLibre +
  sustained binary AirWire load; fails if `aircraft-symbol` is rejected.
- `edge_browser_smoke.spec.js` / `edge_g20_browser_soak.spec.js`: stubs now
  enforce the one-zoom-subexpression rule and load `edge-g20a-aircraft-lod.js`.

Stable `edge` is not promoted. Physical acceptance is one final eyeball test
only after CI confirms the G21 RC image was pushed.
