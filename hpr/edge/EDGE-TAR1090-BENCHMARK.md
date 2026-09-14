# Edge FE vs tar1090 — +30 acceptance

Scope: one ADS-B Edge station, <=400 live aircraft. This benchmark intentionally excludes Atlas-scale rendering and tar1090 niche features that are not part of the Edge job (AIS, UAT/978 without a 978 receiver, weather overlays, audio, multi-instance).

## Capability index

tar1090 is fixed at 100 for the Edge operator job. HPR Edge must score >=130 before stable promotion.

| Domain | tar1090 baseline weight | HPR target factor | HPR points |
|---|---:|---:|---:|
| Live transport / freshness | 20 | 1.60 | 32 |
| Map / visual operator UX | 15 | 1.40 | 21 |
| Search / filter / sort | 15 | 1.00 | 15 |
| Aircraft detail / enrichment | 10 | 1.10 | 11 |
| Real tracks / history | 10 | 1.00 | 10 |
| Coverage tools | 10 | 1.00 | 10 |
| Receiver / station operations | 10 | 1.80 | 18 |
| Mobile operator UX | 5 | 1.40 | 7 |
| Deployment / reliability | 5 | 1.60 | 8 |
| **Total** | **100** |  | **132** |

The CI feature gate proves the required capability is present. It does **not** replace physical performance measurement.

## Mandatory Edge capabilities

- Native binary AirWire live path; additive 0x0A type + registration metadata.
- Full-detail type-aware aircraft marker; no clustering or LOD at Edge scale.
- No per-aircraft status halo.
- Country flag and lazy aircraft photo in detail.
- Type / altitude / source filters; callsign / altitude / distance / seen sort.
- Emergency / rotorcraft / low-altitude presets.
- URL state for aircraft selection, map position and filters.
- Aviation / metric panel units.
- Selected aircraft trace + replay from real readsb traces.
- All Tracks from readsb `trace_recent`, never synthetic browser history.
- Receiver range rings and real readsb `outline.json` 24h reception outline.
- Receiver health: AirWire, tracked count, accepted rate, dropped samples, uptime.
- Responsive mobile composition.
- Single multi-arch Edge image.

## G4 physical shoot-out

Use the same Pi, same browser and the same 400-aircraft synthetic/replay input for both UIs. Run each scenario three times and use the median.

1. Cold page load -> first aircraft visible.
2. Search ICAO/callsign -> selected aircraft detail visible.
3. Filter low-altitude rotorcraft -> correct list/map result.
4. Select aircraft -> real trace visible -> replay starts.
5. Enable All Tracks + coverage -> usable map interaction remains.
6. Open Receiver -> health status understandable without shell access.

Record:

- first-aircraft latency;
- live update latency;
- browser CPU and RAM;
- Pi CPU and RAM;
- network KB/s after steady state;
- operator task completion time for the six scenarios.

Stable `:edge` promotion requires:

- capability score >=130;
- 400-aircraft synthetic AirWire test PASS;
- no critical task regression vs tar1090;
- median total operator task time <= tar1090;
- Edge network traffic and browser/Pi resource usage remain acceptable for the target Pi.

Do not add features solely to increase the score. The score is frozen for this acceptance cycle.
