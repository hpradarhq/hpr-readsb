# Atlas Edge FE migration — G0/G1 provenance

Status: G0 and G1 only. No production UI, adapter, receiver/statistics, renderer, decoder, or backend runtime change is included in this branch.

## Frozen baseline

| Item | Value |
|---|---|
| Production base branch | `dev` |
| Frozen commit | `acf1c95118d254cfa57d1f2d42008ad59c32bb08` |
| Freeze branch | `freeze/edge-ui-pre-atlas-v4.7-20260912` |
| Migration branch | `feat/edge-atlas-v4.7-g0-g1` |
| Pre-migration production UI | `hpr/edge/ui/index.html` |
| Current Edge APIs | `GET /api/air/v1`, `GET /api/readsb/receiver.json`, `GET /data/stats.json` |

The freeze branch is the rollback source. It remains unmodified.

## Source ownership

| Subsystem | Source | Exact reference | G0/G1 disposition |
|---|---|---|---|
| Visual composition, spacing, typography, panel proportions, theme, responsive desktop/tablet/mobile | Atlas V4.7 visual baseline | `fe-v4.7-visual-baseline` @ `3faa1cd7977bfe7e9c2db0fb650c644ae53b2a7b`; artifact blob `66ec05a9f2b0d898873ea91d38bd28a1b3a7ac22` | Canonical fixture, byte-identical |
| Search, collection/detail behavior, controls, layers, responsive sheets, interaction state | Atlas V4.4 interaction complete | `fe-v4.4-interaction-complete` | Inspected only; reserved for G2 |
| Aircraft and rotorcraft SVG mappings/classifier | Atlas V4.8.3 heli | `fe-v4.8.3-heli` @ `907b2dbb7a8a25b574cccd7889b614f88e78701e` | Inspected only; reserved for G3 |
| Adapter isolation patterns | Atlas live adapter/contracts | `live-adapter`, `contracts/v1/reference/hpr-wire-v1.js` | Inspected only; reserved for G4 |
| Edge data contract | HPR readsb | `hpr/airwire/AIRWIRE-V1.md` on `dev` | Read-only; numeric indexes remain out of UI |
| Edge production packaging | HPR readsb | `docker/edge.Dockerfile`, `hpr/edge/nginx.conf` on `dev` | Read-only |

## G1 artifact

`test/fixtures/atlas-v4.7/hpr-atlas-fe-v4.7-canonical.html` is the exact canonical V4.7 artifact. Its Git blob hash is validated by `test/edge-ui-g1.sh`.

It is outside `hpr/edge/ui/`. The production Docker image copies only that directory, so this fixture cannot expose mock aircraft, vessel, AIS, or source data from an Edge appliance.

## Gate results

- G0: PASS — immutable rollback branch created from `dev` commit `acf1c951…`.
- G1: PASS — exact canonical V4.7 visual artifact committed as a non-production fixture; parity is byte-level rather than approximate.
- G2–G7: not started.

## Next gate boundary

G2 may transplant only proven interaction behavior from V4.4 into the V4.7 visual shell. G3 may add the V4.8.3 aircraft/rotorcraft renderer. G4 is the first gate permitted to consume AirWire, through one dedicated adapter that emits named aircraft properties.