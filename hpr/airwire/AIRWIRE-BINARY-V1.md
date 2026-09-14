# HPR AirWire Binary v1

Status: frozen core frames with additive metadata.

This is the production aircraft state wire between HPR readsb Edge and Atlas Edge. The existing JSON AirWire remains diagnostic/fallback output only.

## Compatibility rule

`0x02` and `0x06` are frozen. New information is added as new frame types; existing frame sizes and meanings are never changed.

## 0x02 — aircraft position / motion

Fixed size: 20 bytes. All multi-byte fields are little-endian.

| Offset | Size | Field | Encoding |
| ---: | ---: | --- | --- |
| 0 | 1 | type | `0x02` |
| 1 | 3 | ICAO24 | unsigned 24-bit LE |
| 4 | 4 | longitude | signed int32, degrees × 600000 |
| 8 | 4 | latitude | signed int32, degrees × 600000 |
| 12 | 2 | altitude | signed int16, feet / 25 |
| 14 | 2 | track | unsigned int16, degrees × 10 |
| 16 | 2 | ground speed | unsigned int16, knots × 10 |
| 18 | 2 | vertical rate | signed int16, ft/min |

Backend selection policy:

- emit `0x02` only when readsb has `pos_reliable_valid`;
- altitude: reliable barometric altitude, else valid geometric altitude, else `0`;
- vertical rate: valid barometric rate, else valid geometric rate, else `0`;
- invalid track or ground speed is encoded as `0`;
- source detail such as ADS-B vs MLAT and barometric vs geometric is retained in backend/core state, not added to this fixed frame.

## 0x06 — aircraft identity / status

Fixed size: 15 bytes.

| Offset | Size | Field | Encoding |
| ---: | ---: | --- | --- |
| 0 | 1 | type | `0x06` |
| 1 | 3 | ICAO24 | unsigned 24-bit LE |
| 4 | 8 | callsign | ASCII, NUL padded |
| 12 | 1 | category | native readsb packed category byte (`A0`–`D7`, `00` unset) |
| 13 | 2 | squawk | unsigned 16-bit LE |

Missing callsign is eight NUL bytes. Missing category or squawk is zero.

## 0x0A — aircraft metadata

Fixed size: 20 bytes. This is slow-changing DB-backed metadata used by Edge to select the correct aircraft silhouette and display registration.

| Offset | Size | Field | Encoding |
| ---: | ---: | --- | --- |
| 0 | 1 | type | `0x0A` |
| 1 | 3 | ICAO24 | unsigned 24-bit LE |
| 4 | 4 | ICAO type designator | ASCII, NUL padded; e.g. `A320` |
| 8 | 12 | registration | ASCII, NUL padded; e.g. `VN-A123` |

The backend sources these fields from readsb's local aircraft database through `binCraft`. A blank DB value is encoded as NUL padding. Country flags are derived client-side from ICAO24 allocation and photos are lazy external enrichment; neither belongs on the hot AirWire stream.

## Address policy

Binary v1 carries only a 24-bit ICAO key and has no discriminator for non-ICAO addresses. Therefore non-ICAO readsb addresses are not emitted on binary v1. They remain available in readsb/HPR diagnostic state. This avoids silent key collision. A future additive frame may carry a wider/discriminated identity.

## Delivery

Canonical endpoint: `/ws/air`.

On connection the server sends a binary snapshot of current records. Afterwards it sends binary deltas. Client text control messages accepted for Atlas compatibility:

```text
box:S,N,W,E
box:S,N,W,E,Z
```

`Z` is accepted and ignored by Edge v1. Bbox filtering is applied; LOD decimation and zstd are not part of Edge v1.

Position records are refreshed periodically even if byte-identical to bound silent staleness. Identity and metadata are sent on first visibility for a client and when they change. There is no tombstone frame in v1; FE aging handles disappearances.

## Golden vectors

Position input:

```text
ICAO=ABCDEF lon=106.812345 lat=20.912345 alt=35000
track=90.1 gs=123.4 vr=-640
```

Expected bytes:

```text
02efcdab6fe5d1034f75bf0078058503d20480fd
```

Identity input:

```text
ICAO=ABCDEF callsign=HVN123 category=A3 squawk=1234h
```

Expected bytes:

```text
06efcdab48564e3132330000a33412
```

Metadata input:

```text
ICAO=ABCDEF type=A320 registration=VN-A123
```

Expected bytes:

```text
0aefcdab41333230564e2d413132330000000000
```

These vectors are copied into the C unit test and freeze endianness, scaling and padding behavior.
