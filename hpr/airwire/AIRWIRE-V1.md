# HPR AirWire v1

HPR AirWire is the compact JSON contract between HPR readsb at an edge receiver and Atlas UI.

Design goals: KISS, LEAN, browser-native, stable positional schema, no FE remapping from upstream readsb JSON, and no binary decoder dependency.

## Envelope

```json
[1,1789181234567,82736492,[
  ["8880e3",0,16,"HVN123",20.98765,106.12345,35000,35625,468.2,87.4,-640,null,"1234",163,0,0.2,0.1,-13.5,"VN-A123","A321",0,12548]
]]
```

| Index | Meaning |
| ---: | --- |
| 0 | protocol major version, always `1` |
| 1 | snapshot generation time, Unix milliseconds |
| 2 | receiver total message count |
| 3 | aircraft rows |

## Aircraft row

| Index | Field | Type |
| ---: | --- | --- |
| 0 | ICAO/address | six-character lower-case hex string |
| 1 | address/source class | integer enum |
| 2 | flags | integer bitfield |
| 3 | callsign | string or `null` |
| 4 | latitude | number or `null` |
| 5 | longitude | number or `null` |
| 6 | barometric altitude ft | number or `null` |
| 7 | geometric altitude ft | number or `null` |
| 8 | ground speed kt | number or `null` |
| 9 | track degrees | number or `null` |
| 10 | barometric vertical rate ft/min | number or `null` |
| 11 | geometric vertical rate ft/min | number or `null` |
| 12 | squawk | four-character string or `null` |
| 13 | category byte | integer or `null` |
| 14 | emergency enum | integer or `null` |
| 15 | seconds since reliable position | number or `null` |
| 16 | seconds since last message | number |
| 17 | RSSI dBFS | number |
| 18 | registration | string or `null` |
| 19 | ICAO aircraft type | string or `null` |
| 20 | HPR/readsb DB flags | integer |
| 21 | aircraft message count | integer |

Fields may only be appended in a future compatible extension. Existing indices never change meaning.

## Address/source class

AirWire freezes its own numeric values; the encoder maps upstream `addrtype_t` explicitly rather than exposing the C enum ABI.

| Value | Meaning |
| ---: | --- |
| 0 | ADS-B ICAO |
| 1 | ADS-B ICAO non-transponder |
| 2 | ADS-R ICAO |
| 3 | TIS-B ICAO |
| 4 | ADS-C / JAERO |
| 5 | MLAT |
| 6 | other |
| 7 | Mode-S |
| 8 | ADS-B other address |
| 9 | ADS-R other address |
| 10 | TIS-B track file |
| 11 | TIS-B other address |
| 12 | Mode-A |
| 13 | unknown |

## Flags

| Bit | Hex | Meaning |
| ---: | ---: | --- |
| 0 | `0x01` | aircraft is on ground |
| 1 | `0x02` | alert |
| 2 | `0x04` | SPI/IDENT |
| 3 | `0x08` | non-ICAO address |
| 4 | `0x10` | reliable position present |
| 5 | `0x20` | current reliable position source is MLAT |

Bits 6-31 are reserved for future versions.

## Missing values

Missing scalar values are `null`. Ground state is represented only by the flags bitfield; altitude never changes JSON type to the string `"ground"`.

Address remains hex text because it is an identifier. Numeric values, enums and flags remain JSON numbers; they are not hex strings.

## Output

When `--write-json=<dir>` is active, HPR readsb writes:

```text
<dir>/airwire.json
```

at the existing `--write-json-every` cadence. Atlas/nginx may expose that file as `/api/air/v1`.

AirWire v1 is a full snapshot protocol. WebSocket, delta updates, zstd, protobuf and binCraft are deliberately out of scope.
