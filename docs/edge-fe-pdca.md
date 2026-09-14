# Atlas Edge FE PDCA backlog

Frozen baseline: `f1cadf921bebb2748fbc16a6e83c67fefa683630` (physical-good).

Test branch/tag: `feat/edge-e1-e7-ux` / `edge-ux`.

Broken UX history: `archive/edge-e1-e7-ux-broken-4.8.4-edge.2`.

## Rules

- Keep readsb / AirWire BE frozen unless a FE feature strictly requires otherwise.
- One feature at a time.
- Each feature must pass static/runtime/browser CI before the next feature starts.
- Prefer CSS and pure transforms over observers, timers and background loops.
- No manual Pi acceptance gate is required for progression.
- `edge` stable is not promoted until the full backlog passes.

## Backlog

- [x] G1 Local aircraft rows: no aircraft icon; keep status dot, identity, altitude and speed.
- [x] G2 Browser interaction guard: Chromium smoke catches page crash/main-thread lock and validates list open/close, aircraft click/select, detail close and theme toggle.
- [x] G3 Selected aircraft map state: selected silhouette only; no selected halo; keep hit target and normal status treatment.
- [ ] G4 Calm local list: stable ordering and calm visual refresh while live map remains fast.
- [ ] G5 Aircraft detail identity: country flag + callsign; no aircraft icon in detail header; no flicker.
- [ ] G6 Aircraft detail hierarchy: registration/type/country, LIVE/source/squawk, route, operator, airframe, photo, core metrics, lower telemetry.
- [ ] G7 Enrichment policy: local/offline metadata first; `traffic.hpradar.com` selected-aircraft only; photo lazy selected-only; failure-safe.
- [ ] G8 Station detail: station name/status/coordinates/UUID/software/aircraft/AirWire/signal.
- [ ] G9 Selected trace: `trace_recent` preferred, `trace_full` fallback, never merge; <=90 min; split legs/gaps/impossible jumps; trace below aircraft symbol.
- [ ] G10 Replay: explicit Replay only; compact bottom timeline; normal select/trace never opens replay; no overlap with LOCAL AIRCRAFT.
- [ ] G11 All Tracks: remain disabled/hidden until segmentation is independently trustworthy.
- [ ] G12 Settings shell: compact Receiver | Display | Feeds | Security tabs.
- [ ] G13 Receiver settings: name/lat/lon/height/UUID; persistent in `/data/hpr-edge`; station/feed changes restart readsb child only, not Docker.
- [ ] G14 Display settings: units/range rings/count/spacing/color/actual-range outline; persistence.
- [ ] G15 Feeds presets: user-facing provider list; HPRadar first; custom host/port/protocol only for Custom aggregator.
- [ ] G16 Security: 6-digit PIN control for admin changes.
- [ ] G17 Vietnam map-label policy: suppress Sansha/Nansha; show HOÀNG SA/TRƯỜNG SA; city-sized labels; survive style/theme reload.
- [ ] G18 Responsive composition: rail/list left, detail right desktop; tablet/mobile sheets; no overlap with map controls; explicit close/auto-close.
- [ ] G19 Search/filter UX: ranked keyboard search, stable collection/detail state, rotor/emergency filters without list jitter.
- [ ] G20 Performance/soak: 400-aircraft browser soak, bounded DOM/memory, no long main-thread lock; E7 comparator remains synthetic signal only.
- [ ] G21 Release gate: full Chromium regression suite + arm64/armv7 image; promote only after all above pass.

## PDCA contract per gate

**Plan** — one narrowly scoped behavior and explicit acceptance contract.

**Do** — smallest possible change.

**Check** — syntax + focused runtime test + Chromium interaction/soak where applicable + existing AirWire/readsb tests.

**Act** — keep only on PASS; otherwise revert the gate before proceeding.
