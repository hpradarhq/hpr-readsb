# G20A-D to G21 release candidate

Candidate: FE `4.7.5-edge.rc6`, build `260916.rc5`, branch `redteam/edge-freeze-20260915`.

Supersedes `4.7.5-edge.rc1` (`121a0eb`), which failed physical acceptance: real Pi
Edge FE froze while the mocked Chromium + synthetic 400-aircraft CI stayed green.
`rc2` carried the freeze fix but its tag run tripped a pre-existing feeds-panel
race; `rc3` added the deterministic feeds reload; `rc4` fixed the map UX found on
the physical build; `rc5` lands the FR24-parity phases P1-P5 (see
`edge-fe-fr24-parity.md`).

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

## rc4 physical UX fixes

- `edge-g20a-aircraft-lod.js`: aircraft icons now allow overlap so every
  silhouette renders at operational zoom (collision previously left only one
  icon visible); the status halo ring is fully transparent (the "green circle").
- `edge-g18-responsive.js`: MapLibre controls no longer slide left when the
  detail card opens; they stay pinned top-right.
- `edge-g9-trace.js` + `airwire-adapter.js`: selecting an aircraft always shows
  a trace. readsb `trace_recent`/`trace_full` remain the primary source, with a
  browser-side live trail fallback from the AirWire position history; trace line
  is thicker/brighter.
- `edge-g10-replay.js`: default replay speed 20× (was 5×) and a larger, clearer
  replay marker so playback is actually visible.

## Regression

- `test/edge_g21_real_map.spec.js`: production script set + real MapLibre +
  sustained binary AirWire load; fails if `aircraft-symbol` is rejected, asserts
  icons allow overlap, the halo ring is transparent, selecting shows a trace,
  and the controls stay pinned when the card opens.
- `edge_browser_smoke.spec.js` / `edge_g20_browser_soak.spec.js`: stubs now
  enforce the one-zoom-subexpression rule and load `edge-g20a-aircraft-lod.js`.

Stable `edge` is not promoted. Physical acceptance is one final eyeball test
only after CI confirms the G21 RC image was pushed.
