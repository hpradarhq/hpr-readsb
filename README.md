# HPR readsb

HPRadar's thin fork of [`wiedehopf/readsb`](https://github.com/wiedehopf/readsb) for ADS-B edge receivers.

The rule for this fork is simple: **keep the upstream RF / Mode-S / ADS-B engine intact and add only the HPR-specific boundary needed by HPRadar.**

This branch adds **HPR AirWire v1**, a compact positional JSON contract emitted directly from readsb aircraft state for HPR Atlas frontends.

> Status: experimental HPR integration branch. The upstream-compatible `dev` branch remains untouched.

## Layout

```text
root *.c / *.h       upstream readsb territory
hpr/airwire/         HPR AirWire implementation + contract
hpr/                 HPR fork notes/baseline
```

Do not reorganize upstream source files; keeping their paths intact keeps rebases small.

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
[1,1789181234567,82736492,[["8880e3",0,16,"HVN123",20.98765,106.12345,35000,35625,468.2,87.4,-640,null,"1234",163,0,0.2,0.1,-13.5,"VN-A123","A321",0,12548]]]
```

The aircraft row has 22 frozen positional fields. Missing values are `null`; future compatible fields are append-only.

See [`hpr/airwire/AIRWIRE-V1.md`](hpr/airwire/AIRWIRE-V1.md) for the protocol contract.

## Build

```bash
git clone -b hpr-airwire-v1 https://github.com/hpradarhq/hpr-readsb.git
cd hpr-readsb
make -j"$(nproc)" RTLSDR=yes DISABLE_INTERACTIVE=yes
```

Run with local snapshots:

```bash
mkdir -p /run/readsb
./readsb --device-type rtlsdr --gain auto --net --write-json=/run/readsb --write-json-every=1
```

AirWire output:

```text
/run/readsb/airwire.json
```

## Optional HPR central feed

```bash
./readsb \
  ... \
  --uuid=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx \
  --net-connector=atlas.example.net,30004,beast_reduce_plus_out
```

Receiver identity and Beast transport remain readsb-native; HPR AirWire is the local BE-to-FE contract.

## Branch model

```text
dev                     upstream-compatible mirror
 `-- hpr-airwire-v1      HPR protocol/core
      `-- edge-appliance-v1  deployable edge product
```

## KISS / LEAN rules

This branch intentionally does not introduce protobuf, a second backend process, a new HTTP server in C, browser-side readsb mapping, decoder changes, or tar1090 UI code.

The production edge appliance lives on branch [`edge-appliance-v1`](https://github.com/hpradarhq/hpr-readsb/tree/edge-appliance-v1).

## Upstream

HPR readsb is based on [`wiedehopf/readsb`](https://github.com/wiedehopf/readsb), lineage `dump1090 -> dump1090-fa -> Mictronics/readsb -> wiedehopf/readsb`.

For decoder options, SDR support, traces, APIs, and legacy formats, use upstream documentation.

## License

This fork retains the upstream license and copyright notices. See [`LICENSE`](LICENSE).
