# G6 real-device acceptance

G6 is a physical-device gate. It passes only from a receipt collected on a Pi 3/4/5 or Orange Pi ARMv7 node using an RTL-SDR. CI and workstation runs establish readiness but do not substitute for this receipt.

## Preconditions

- Build the migration branch `feat/edge-atlas-v4.7-g3-g6` as `linux/arm64` and `linux/arm/v7`.
- Connect the RTL-SDR and configure the station environment used by `deploy/compose.pi.yml`.
- Open Atlas Edge in a desktop browser and one tablet/mobile viewport during the sampling run.
- Use a replay or live high-density window that reaches 400 aircraft for the UI capacity observation. The acceptance script rejects a snapshot above the declared 400-aircraft design target.

## Run

From the repository checkout on the device:

```sh
HPR_G6_SAMPLES=300 \
HPR_G6_REQUIRE_AIRCRAFT=400 \
HPR_G6_RECEIPT=g6-acceptance-pi.json \
node test/edge-g6-acceptance.mjs http://127.0.0.1:8080
docker stats --no-stream --format '{{json .}}' > g6-docker-stats.json
```

The five-minute run checks the visible FE version endpoint, receiver/stats/station endpoints, active local SDR sample blocks, AirWire v1 validity, message growth, 1 Hz generation cadence, p95 API latency, and aircraft count. Preserve the two JSON files with the candidate commit SHA and device model.

## Manual visual checks

- V4.7 map-first composition remains intact at desktop, tablet, and mobile sizes.
- Search, collection/detail selection, map fit, theme, receiver sheet, and Escape dismissal work during live polling.
- Each of `MH6`, `B222`, `V22`, `AH1Z`, `AH1J`, and `A129` uses its exact rotorcraft SVG when present.
- Other rotorcraft remain in the aircraft ontology and use the established aircraft fallback; there is no generic helicopter or triangle marker.
- Map interaction remains fluid at the 400-aircraft observation point and no browser console errors appear.

Record the candidate as G6 PASS only when the automated receipt result is `PASS`, the Docker stats record is attached, and all manual checks pass on real ARM hardware with the RTL-SDR active.
