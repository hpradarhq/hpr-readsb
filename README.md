# HPRadar Edge ADS-B Receiver

Lean HPRadar edge appliance based on [`wiedehopf/readsb`](https://github.com/wiedehopf/readsb).

```text
RTL-SDR -> HPR readsb -> AirWire v1 -> Atlas Edge UI
                    \
                     -> BeastReduce+UUID -> HPR central
```

## Layout

```text
root *.c / *.h       upstream readsb territory — keep intact
hpr/airwire/         HPR AirWire C + protocol contract
hpr/edge/            Atlas Edge UI + nginx + entrypoint
docker/              edge image definition
deploy/              compose + env + newbie guide
.github/workflows/    CI/CD
```

The flat upstream root is intentional. HPR code stays namespaced so upstream rebases remain small.

## Image

```text
ghcr.io/hpradarhq/hpr-readsb-edge:edge
```

Platforms:

- `linux/arm64` — Raspberry Pi 3/4/5 with 64-bit OS
- `linux/arm/v7` — Orange Pi Plus 2E / ARMv7

## Quick edge test

```bash
git clone https://github.com/hpradarhq/hpr-readsb.git
cd hpr-readsb/deploy
cp .env.example .env
nano .env

docker compose pull
docker compose up -d
docker compose ps
```

Generate one stable feeder UUID:

```bash
cat /proc/sys/kernel/random/uuid
```

Put it in `.env` as `HPR_FEEDER_UUID`, then open:

```text
http://EDGE_NODE_IP:8080
```

Verify:

```bash
curl -s http://localhost:8080/api/air/v1
docker compose logs -f hpr-edge
```

Detailed setup and troubleshooting: [`deploy/README.md`](deploy/README.md).

## AirWire v1

AirWire is serialized directly from readsb aircraft state. Atlas Edge reads it directly; there is no legacy `aircraft.json -> HPR model` conversion in the browser.

Contract: [`hpr/airwire/AIRWIRE-V1.md`](hpr/airwire/AIRWIRE-V1.md).

## CI/CD

`.github/workflows/edge-image.yml` builds [`docker/edge.Dockerfile`](docker/edge.Dockerfile) and publishes one GHCR multi-arch manifest for `arm64` and `arm/v7`.

No tar1090 frontend, protobuf, Node/npm runtime, or Atlas Go backend is required on the edge node.

## Upstream policy

HPR keeps the readsb RF / Mode-S / ADS-B / CPR / tracking core upstream-compatible. HPR-specific code belongs under `hpr/`; do not reorganize the upstream flat C/H source tree.

## License

This fork retains upstream copyright and license requirements. See [`LICENSE`](LICENSE).
