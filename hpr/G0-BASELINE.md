# HPR readsb G0 baseline

Baseline for the HPRadar fork before AirWire changes.

- Upstream lineage: `wiedehopf/readsb`
- HPR fork branch preserved as upstream mirror: `dev`
- Baseline commit: `d9a4c62655490e70d07704e207738bb9c6cffde1`
- Upstream readsb version: `3.16.16`
- HPR work branch: `hpr-airwire-v1`
- Default JSON interval: 1000 ms
- Existing feeder transport retained unchanged: `beast_reduce_plus_out` + receiver UUID

## G0 invariants

HPR changes must not modify demodulation, Mode-S/ADS-B decode, CPR, tracking, receiver UUID handling, Beast output, or BeastReduce behavior.

The initial HPR patch surface is limited to:

1. HPR AirWire serializer/output.
2. Build linkage required for that serializer.
3. Protocol documentation and validation.

No feature removal, Docker slimming, or edge build profile belongs to G0/G1.

## Baseline build verification

The repository's existing pull-request Docker workflow builds both `linux/amd64` and `linux/arm64`. The G1 pull request is used as the first fork-local compile gate because this newly created fork has no historical Actions run yet.

G0 is considered preserved when the G1 diff shows no changes to RF/DSP/decode/tracking/Beast code and the pull-request build passes.
