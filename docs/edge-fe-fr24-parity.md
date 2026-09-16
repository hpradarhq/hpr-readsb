# Atlas Edge FE: Flightradar24-parity roadmap

Current state: correct and performant at the target 400-aircraft load (rc4), but
visually sparse next to FR24. This plan closes the live-map gap while staying
LEAN: browser-only, reuse the binary AirWire stream, no backend/protocol changes
unless a phase proves one is required.

## Principles

- Render from AirWire only; the browser owns presentation, readsb owns truth.
- Every phase ships behind the real-MapLibre + real-load regression
  (`test/edge_g21_real_map.spec.js`) and a throttled perf budget.
- One map source, batched `setData` on `requestAnimationFrame`, no per-aircraft
  DOM on the map.
- Physical Pi eyeball is the promotion gate; `edge` stays untouched until then.

## Per-phase definition of done

- p95 long task < 50 ms and frame p95 < 33 ms at 400 aircraft on 4x CPU throttle.
- No snapping/stutter during sustained 250 ms AirWire updates.
- JS heap flat over a 30-minute soak; no console errors.
- Regression spec updated and green; physical acceptance recorded.

## Phase 1 - smooth live map (highest impact)

- Client-side dead reckoning: advance each aircraft along `track` at
  `groundSpeedKt` every animation frame; re-anchor on each AirWire frame.
- Batch map updates: decode into a typed buffer, then one `setData` per frame.
- Trails on by default: last ~2 minutes per aircraft from a ring buffer
  (already kept in `airwire-adapter.js`); long readsb traces on demand.
- Clustering/grid declutter below zoom ~6; split when a cell expands.
- Impact: removes the 250 ms snapping that makes the map feel frozen.

## Phase 2 - visual parity

- Altitude colour ramp on icons/dots (e.g. 0-45k ft) and a climb/descend cue.
- Expand the silhouette set (airliner families, GA, military, rotorcraft) and
  optional airline tail logos.
- Label policy: callsign + altitude, priority-based declutter, zoom thresholds.
- Basemap polish: tuned dark/light vector styles, optional terrain, airport and
  airspace overlays.

## Phase 3 - interaction and data parity

- Filters: altitude band, speed, vertical rate, air/ground, type, source; saved
  views.
- Detail panel: route/airline/photo (G7 exists), live route progress, telemetry
  sparkline.
- Search: callsign/reg/type/route/airport ranking (extend G19).
- Click-to-follow/lock, multi-select, nearest-airport, distance/bearing readout.

## Phase 4 - playback and history

- Full-day replay with a time scrubber, speed presets and day picker from the
  readsb globe history.
- Default short trail history; trace export.
- Station dashboards: range, message rate, signal, coverage.

## Phase 5 - platform

- PWA install + offline shell; watch-list and emergency-squawk notifications.
- Accessibility (keyboard, ARIA, contrast) and EN/VN i18n.
- Field perf HUD for on-device diagnosis.

## Suggested order and impact

| Phase | Impact | Effort | Risk |
|---|---|---|---|
| 1 Smooth live map | Very high | Medium | Medium (rAF budget) |
| 2 Visual parity | High | Medium | Low |
| 3 Interaction/data | High | High | Low |
| 4 Playback/history | Medium | High | Medium |
| 5 Platform | Medium | Medium | Low |
