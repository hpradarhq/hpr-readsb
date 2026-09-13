# syntax=docker/dockerfile:1.7

ARG FE_VERSION=4.7.1
ARG FE_BUILD=260912.1

FROM debian:bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      pkg-config \
      wget \
      librtlsdr-dev \
      libusb-1.0-0-dev \
      zlib1g-dev \
      libzstd-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
COPY . .

RUN make clean \
    && make -j"$(nproc)" readsb RTLSDR=yes DISABLE_INTERACTIVE=yes OPTIMIZE="-O2" \
    && make hpr-airwire-test DISABLE_INTERACTIVE=yes \
    && strip readsb \
    && mkdir -p /out \
    && cp readsb /out/readsb \
    && wget --timeout=20 --tries=4 --retry-connrefused \
       -O /out/aircraft.csv.gz \
       https://raw.githubusercontent.com/wiedehopf/tar1090-db/csv/aircraft.csv.gz

FROM debian:bookworm-slim

ARG FE_VERSION
ARG FE_BUILD

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      nginx \
      tzdata \
      librtlsdr0 \
      libusb-1.0-0 \
      zlib1g \
      libzstd1 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default \
    && mkdir -p /run/readsb /usr/local/share/hpr-readsb /usr/share/nginx/html

COPY --from=builder /out/readsb /usr/local/bin/readsb
COPY --from=builder /out/aircraft.csv.gz /usr/local/share/hpr-readsb/aircraft.csv.gz
COPY hpr/edge/nginx.conf /etc/nginx/nginx.conf
COPY hpr/edge/entrypoint.sh /usr/local/bin/hpr-edge
COPY hpr/edge/ui/ /usr/share/nginx/html/

RUN sed -i \
      -e "s|<title>HPRadar Atlas Edge</title>|<title>HPRadar Atlas Edge · FE v${FE_VERSION}</title>|" \
      -e "s|V4.7 LIVE / AIRWIRE|FE v${FE_VERSION} · ${FE_BUILD}|" \
      -e 's|</head>|<script src="/hpr-config.js"></script>\n</head>|' \
      /usr/share/nginx/html/index.html \
    && printf '{"fe":"%s","build":"%s","airwire":"binary-v1"}\n' "$FE_VERSION" "$FE_BUILD" > /usr/share/nginx/html/version.json \
    && chmod 0755 /usr/local/bin/readsb /usr/local/bin/hpr-edge

LABEL org.opencontainers.image.title="HPRadar Atlas Edge" \
      org.opencontainers.image.version="${FE_VERSION}" \
      hpradar.fe.build="${FE_BUILD}" \
      hpradar.airwire="binary-v1"

ENV READSB_JSON_INTERVAL=1 \
    READSB_GAIN=auto \
    HPR_UPSTREAM_PORT=30004 \
    HPR_AIRWIRE_WS_PORT=30154

EXPOSE 80 30002 30003 30004 30005

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD test -s /run/readsb/airwire.json || exit 1

ENTRYPOINT ["/usr/local/bin/hpr-edge"]
