# HPRadar Edge — readsb + AirWire + Atlas UI

This is the small edge appliance for HPRadar ADS-B receivers.

```text
RTL-SDR -> HPR readsb -> AirWire v1 -> Atlas Edge UI
                    \
                     -> optional BeastReduce + UUID -> central HPR Atlas
```

It intentionally does **not** include tar1090, binCraft, protobuf, Node.js, npm, or the Atlas Go backend.

The Docker image is multi-arch:

- `linux/arm64` — Raspberry Pi 3/4/5 running a 64-bit OS.
- `linux/arm/v7` — Orange Pi Plus 2E / 32-bit Armbian, and other ARMv7 nodes.

Image:

```text
ghcr.io/hpradarhq/hpr-readsb-edge:edge
```

## 1. Check the node

Plug in the RTL-SDR, then run:

```bash
uname -m
lsusb
```

Expected architecture:

```text
Raspberry Pi 64-bit : aarch64
Orange Pi ARMv7     : armv7l
```

Docker automatically pulls the matching image from the same multi-arch tag.

## 2. Install Docker if needed

On a fresh Debian / Raspberry Pi OS / Armbian node:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
```

Log out and back in once after adding your user to the `docker` group.

Verify:

```bash
docker version
docker compose version
```

## 3. Create a test directory

Copy `compose.yml` from this repository and create `.env` beside it.

Minimal `.env`:

```dotenv
HPR_FEEDER_UUID=
RECEIVER_LAT=
RECEIVER_LON=
```

Generate the receiver UUID **once** and keep it for the life of that receiver:

```bash
cat /proc/sys/kernel/random/uuid
```

Put the result in `.env`:

```dotenv
HPR_FEEDER_UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Receiver latitude/longitude are optional but recommended:

```dotenv
RECEIVER_LAT=20.8449
RECEIVER_LON=106.6881
```

Do not copy those example coordinates to another site.

## 4. Start the edge appliance

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Open from another machine on the same LAN:

```text
http://EDGE_NODE_IP:8080
```

The UI is the lean edge composition derived from the Atlas V4.7 visual baseline. It reads HPR AirWire directly; there is no tar1090 data model in the browser.

## 5. Verify data

AirWire:

```bash
curl -s http://localhost:8080/api/air/v1
```

readsb receiver metadata:

```bash
curl -s http://localhost:8080/api/readsb/receiver.json
```

Container logs:

```bash
docker compose logs -f hpr-edge
```

Useful ports:

| Port | Purpose |
| ---: | --- |
| `8080` | Atlas Edge UI + JSON API |
| `30002` | raw Mode-S output |
| `30003` | SBS/BaseStation output |
| `30004` | BeastReduce output |
| `30005` | Beast output |

## 6. Optional: feed central HPR Atlas

Set the central host in `.env`:

```dotenv
HPR_UPSTREAM_HOST=atlas-ingest.example.net
HPR_UPSTREAM_PORT=30004
HPR_FEEDER_UUID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Then recreate the container:

```bash
docker compose up -d
```

The edge readsb connects outbound using `beast_reduce_plus_out`; the receiver UUID is carried by readsb. Local Atlas Edge UI continues to use AirWire.

## 7. Gain and range

Defaults are deliberately conservative:

```dotenv
READSB_GAIN=auto
READSB_JSON_INTERVAL=1
```

Optional hard range limit in nautical miles:

```dotenv
READSB_MAX_RANGE_NM=300
```

## 8. Upgrade

```bash
docker compose pull
docker compose up -d
```

The tag `edge` tracks the current edge-appliance branch build. Release tags use `edge-v*`.

## Troubleshooting

### UI opens but no aircraft appear

Check that AirWire exists:

```bash
curl -i http://localhost:8080/api/air/v1
```

Then inspect readsb:

```bash
docker compose logs --tail=200 hpr-edge
```

### RTL-SDR is visible in `lsusb` but readsb cannot claim it

A host DVB driver may own the dongle. For a temporary test:

```bash
sudo rmmod dvb_usb_rtl28xxu rtl2832_sdr rtl2832 2>/dev/null || true
docker compose restart hpr-edge
```

If that fixes it, configure the host OS to blacklist the DVB modules before production deployment.

### `docker pull` returns `denied` / `unauthorized`

The GHCR package must be public for anonymous edge pulls. If the package was created private, change the package visibility to **Public** in GitHub Packages, or authenticate the node to GHCR.

### Wrong architecture

```bash
docker image inspect ghcr.io/hpradarhq/hpr-readsb-edge:edge --format '{{.Architecture}}/{{.Variant}}'
```

Expected is `arm64` on the 64-bit Pi image or `arm/v7` on the 32-bit Orange Pi image.

## Design boundary

Edge owns:

- SDR access and 1090 MHz decode through readsb.
- local aircraft state.
- AirWire v1 snapshot.
- local Atlas UI.
- optional upstream BeastReduce + UUID.

Edge does not own central multi-receiver dedup/fusion, global history, AIS, fleet/network catalog data, or Atlas central control-plane functions.
