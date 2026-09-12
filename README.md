# HPR readsb

HPRadar's thin fork of [`wiedehopf/readsb`](https://github.com/wiedehopf/readsb) for ADS-B edge receivers.

The rule for this fork is simple: **keep the upstream RF / Mode-S / ADS-B engine intact and add only the HPR-specific boundary needed by HPRadar.**

This branch adds **HPR AirWire v1**, a compact positional JSON contract emitted directly from readsb aircraft state for HPR Atlas frontends.

> Status: experimental HPR integration branch. The upstream-compatible `dev` branch remains untouched.

## Architecture

```text
SDR / I-Q
   |
   v
wiedehopf/readsb core
   |- RF demodulation
   |- Mode-S / ADS-B decode
   |- CPR / tracking
   |- local aircraft state
   |
   +--> BeastReduce+UUID --> HPR central ingest
   |
   +--> HPR AirWire v1 --> Atlas UI
```

HPR does **not** replace or fork the DSP, Mode-S, CPR, tracking, or Beast receiver logic.

## Why AirWire

Classic readsb web clients normally consume keyed JSON or binCraft and then build their own browser-side model.

HPR AirWire removes that extra mapping layer:

```text
readsb aircraft state
        |
        v
HPR AirWire positional JSON
        |
        v
Atlas UI store / render
```

The browser does not translate `aircraft.json` into another aircraft object model.

## AirWire v1

Snapshot envelope:

```json
[
  1,
  1789181234567,
  82736492,
  [
    ["8880e3",0,16,"HVN123",20.98765,106.12345,35000,35625,468.2,87.4,-640,null,"1234",163,0,0.2,0.1,-13.5,"VN-A123","A321",0,12548]
  ]
]
```

Top-level fields:

| Index | Meaning |
| ---: | --- |
| `0` | AirWire major version |
| `1` | generation time, Unix milliseconds |
| `2` | receiver message counter |
| `3` | aircraft rows |

Aircraft row v1:

| Index | Field |
| ---: | --- |
| `0` | ICAO hex |
| `1` | source enum |
| `2` | flags bitfield |
| `3` | callsign |
| `4` | latitude |
| `5` | longitude |
| `6` | barometric altitude |
| `7` | geometric altitude |
| `8` | ground speed |
| `9` | track |
| `10` | barometric vertical rate |
| `11` | geometric vertical rate |
| `12` | squawk |
| `13` | category |
| `14` | emergency enum |
| `15` | seconds since position |
| `16` | seconds since last message |
| `17` | RSSI |
| `18` | registration |
| `19` | ICAO aircraft type |
| `20` | database flags |
| `21` | aircraft message count |

Missing values are `null`. Trailing unused fields may be omitted. Existing indices are immutable within AirWire v1; new fields may only be appended.

The current flags bitfield reserves:

```text
0x01 ground
0x02 alert
0x04 SPI
0x08 non-ICAO
0x10 valid position
0x20 stale position
0x40 MLAT position
```

See [`docs/HPR-AIRWIRE-V1.md`](docs/HPR-AIRWIRE-V1.md) for the protocol contract.

## Build

Typical RTL-SDR development build:

```bash
git clone -b hpr-airwire-v1 https://github.com/hpradarhq/hpr-readsb.git
cd hpr-readsb
make -j"$(nproc)" RTLSDR=yes DISABLE_INTERACTIVE=yes
```

Run with local JSON/AirWire snapshots:

```bash
mkdir -p /run/readsb

./readsb \
  --device-type rtlsdr \
  --gain auto \
  --net \
  --write-json=/run/readsb \
  --write-json-every=1
```

AirWire is written alongside readsb's regular snapshot outputs:

```text
/run/readsb/airwire.json
```

## Optional HPR central feed

readsb's existing BeastReduce+UUID mechanism remains the upstream transport to a central HPR collector:

```bash
./readsb \
  ... \
  --uuid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --net-connector=atlas.example.net,30004,beast_reduce_plus_out
```

Receiver identity and Beast transport remain readsb-native; HPR AirWire is the local BE-to-FE contract.

## Branch model

```text
dev
 |- upstream-compatible mirror
 |
 +-- hpr-airwire-v1
      |- HPR AirWire protocol
      |- HPR serializer
      `- minimal output hook
```

The HPR patch should remain small enough to rebase regularly onto upstream `wiedehopf/readsb`.

## KISS / LEAN rules

This branch intentionally does not introduce:

- protobuf
- a second backend process
- a new HTTP server in C
- a browser-side readsb-to-Atlas mapper
- changes to readsb DSP / decoder / CPR / tracking
- tar1090 UI code

The production edge appliance, Atlas Edge UI, Docker image, Compose file, and multi-arch CI/CD live on branch [`edge-appliance-v1`](https://github.com/hpradarhq/hpr-readsb/tree/edge-appliance-v1).

## Upstream

HPR readsb is based on:

- [`wiedehopf/readsb`](https://github.com/wiedehopf/readsb)
- lineage: `dump1090` -> `dump1090-fa` -> `Mictronics/readsb` -> `wiedehopf/readsb`

For upstream readsb options, decoder documentation, SDR support, traces, APIs, and legacy JSON formats, use the upstream repository documentation.

## License

This fork retains the upstream readsb license and copyright notices. See [`LICENSE`](LICENSE).

HPR-specific changes are distributed under the same repository licensing requirements where applicable.
