# Atlas Edge FE migration — G0 through G6 provenance

Status: G0 through G5 pass automated source and contract gates. G6 implementation and real-device acceptance tooling are complete; the physical ARM + RTL-SDR receipt is still required before G6 can be marked passed. No backend runtime change is included.

## Frozen baseline

| Item | Value |
|---|---|
| Production base branch | `dev` |
| Frozen commit | `acf1c95118d254cfa57d1f2d42008ad59c32bb08` |
| Freeze branch | `freeze/edge-ui-pre-atlas-v4.7-20260912` |
| Migration branch | `feat/edge-atlas-v4.7-g3-g6` |
| Pre-migration production UI | `hpr/edge/ui/index.html` |
| Current Edge APIs | `GET /api/air/v1`, `GET /api/readsb/receiver.json`, `GET /data/stats.json` |

The freeze branch is the rollback source. It remains unmodified.

## Source ownership

| Subsystem | Source | Exact reference | G0/G1 disposition |
|---|---|---|---|
| Visual composition, spacing, typography, panel proportions, theme, responsive desktop/tablet/mobile | Atlas V4.7 visual baseline | `fe-v4.7-visual-baseline` @ `3faa1cd7977bfe7e9c2db0fb650c644ae53b2a7b`; artifact blob `66ec05a9f2b0d898873ea91d38bd28a1b3a7ac22` | Canonical fixture, byte-identical |
| Search, collection/detail behavior, controls, layers, responsive sheets, interaction state | Atlas V4.4 interaction complete | `fe-v4.4-interaction-complete`; V4.4/V4.4.1 freeze records and V4.7 descendant implementation | Frozen and source-validated in G2 |
| Aircraft and rotorcraft SVG mappings/classifier | Atlas V4.8.3 heli | `fe-v4.8.3-heli` @ `907b2dbb7a8a25b574cccd7889b614f88e78701e` | G3: exact classifier family and six exact SVG assets only; V4.8 chrome excluded |
| Adapter isolation patterns | Atlas live adapter/contracts | `live-adapter`, `contracts/v1/reference/hpr-wire-v1.js` | G4: positional contract isolated in `airwire-adapter.js`; UI gets named properties |
| Edge data contract | HPR readsb | `hpr/airwire/AIRWIRE-V1.md` on `dev` | Read-only; numeric indexes remain out of UI |
| Receiver, statistics, station context | HPR readsb Edge JSON | `/api/readsb/receiver.json`, `/data/stats.json`, `/api/readsb/station.json` | G5: normalized by `station-context.js`; no new backend or gateway |
| Edge production packaging | HPR readsb | `docker/edge.Dockerfile`, `hpr/edge/nginx.conf` on `dev` | UI version bumped; runtime and routes unchanged |

## G3 rotorcraft ownership

| ICAO type | Exact V4.8.3 asset |
|---|---|
| `MH6` | `xBoeing_MH-6_1.svg` |
| `B222` | `xBell_222_1.svg` |
| `V22` | `V22.svg` |
| `AH1Z` | `Bell_AH-1Z_Viper.svg` |
| `AH1J` | `Bell_AH-1J.svg` |
| `A129` | `Augusta_A129.svg` |

The asset files are Git-blob checked in `test/aircraft-renderer.test.mjs`. Rotorcraft are always `kind: aircraft`; classifier-only rotorcraft without an exact asset keep the V4.7 fixed-wing fallback instead of introducing a generic rotorcraft drawing.

## G4 model boundary

`airwire-adapter.js` is the sole owner of AirWire envelope indexes, row indexes, flag bits, source enum values, and category-byte conversion. It emits named identity, position, motion, signal, freshness, and state properties. `index.html` contains no positional AirWire reads.

## G1 artifact

`test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html` is the exact canonical V4.7 artifact. Its Git blob hash is validated by `test/edge-ui-g1.sh`.

It is outside `hpr/edge/ui/`. The production Docker image copies only that directory, so this fixture cannot expose mock aircraft, vessel, AIS, or source data from an Edge appliance.

## Gate results

- G0: PASS — immutable rollback branch created from `dev` commit `acf1c951…`.
- G1: PASS — exact canonical V4.7 visual artifact committed as a non-production fixture; parity is byte-level rather than approximate.
- G2: PASS — V4.4 interaction behavior inherited by the canonical V4.7 descendant is syntax-checked and locked by `test/edge-ui-g2.mjs`.
- G3: PASS — exact V4.8.3 mappings/assets and rotorcraft-as-aircraft ontology are locked by `test/aircraft-renderer.test.mjs`.
- G4: PASS — AirWire v1 translates into the named Atlas aircraft model in `airwire-adapter.js`, locked by `test/airwire-adapter.test.mjs`.
- G5: PASS — live receiver, readsb statistics, and station metadata populate the aircraft-first receiver sheet, locked by `test/station-context.test.mjs`.
- G6: READY / PHYSICAL RECEIPT PENDING — 400-aircraft contract handling passes `test/edge-g6-capacity.test.mjs`; the five-minute real-device runner is `test/edge-g6-acceptance.mjs`. See `G6-ACCEPTANCE.md`.
- G7: not started.

## G2 donor finding

The V4.4 branch records the authoritative interaction behavior in `talk/fe-v4.4-baseline.md` and `talk/fe-v4.4.1-qa-freeze.md`. The later committed `static/atlas-v4.4.2.html` at `cf1c9ffd09d85adc41e628f40c6e9dd2c2bb4b25` is only a 14,599-character incomplete shell: its own script says the complete implementation is elsewhere. Commit `2001a1b116cdc9ccc479e7d9c6de0edecfc3dc10` immediately removes it as incomplete.

The canonical V4.7 artifact contains the complete descendant implementation of the verified V4.4 behaviors. G2 therefore freezes those interactions in place instead of copying the incomplete V4.4.2 shell. The gate checks exact-code search ranking and keyboard navigation, collection/detail state, map controls, layers/settings/preferences, responsive desktop/tablet/mobile composition, and contract-free fixture behavior.

## Release boundary

Do not merge to `dev` or create the G7 production freeze until a real ARM device with RTL-SDR produces a passing G6 receipt and the live visual checks are signed off.
