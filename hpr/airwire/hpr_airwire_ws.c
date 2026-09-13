#include "hpr_airwire_ws.h"
#include "hpr_airwire_bin.h"
#include "../../readsb.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <poll.h>
#include <pthread.h>
#include <sys/socket.h>
#include <unistd.h>

#define HPR_WS_DEFAULT_PORT 30154
#define HPR_WS_MAX_CLIENTS 16
#define HPR_WS_CACHE_MAX 2048
#define HPR_WS_RX_MAX 512
#define HPR_WS_SCAN_MS 250
#define HPR_WS_REFRESH_MS 15000
#define HPR_WS_STALE_MS 120000
#define HPR_WS_PAYLOAD_MAX (HPR_WS_CACHE_MAX * (HPR_AIRWIRE_POS_SIZE + HPR_AIRWIRE_IDENT_SIZE))

#ifndef MSG_NOSIGNAL
#define MSG_NOSIGNAL 0
#endif

typedef struct {
    int fd;
    int bbox_set;
    double south, north, west, east;
    uint8_t rx[HPR_WS_RX_MAX];
    size_t rx_len;
    uint32_t known[HPR_WS_CACHE_MAX];
    size_t known_len;
} hpr_ws_client_t;

typedef struct {
    uint32_t icao;
    uint8_t pos[HPR_AIRWIRE_POS_SIZE];
    uint8_t ident[HPR_AIRWIRE_IDENT_SIZE];
    int have_pos;
    double lat;
    double lon;
    int64_t last_seen_ms;
    int64_t last_pos_sent_ms;
} hpr_ws_cache_t;

typedef struct {
    uint32_t icao;
    uint8_t pos[HPR_AIRWIRE_POS_SIZE];
    uint8_t ident[HPR_AIRWIRE_IDENT_SIZE];
    int pos_changed;
    int ident_changed;
    int have_pos;
    double lat;
    double lon;
} hpr_ws_change_t;

static pthread_once_t hpr_ws_once = PTHREAD_ONCE_INIT;
static hpr_ws_cache_t hpr_cache[HPR_WS_CACHE_MAX];
static size_t hpr_cache_len;

typedef struct {
    uint32_t h[5];
    uint64_t bits;
    uint8_t block[64];
    size_t used;
} hpr_sha1_t;

static uint32_t rol32(uint32_t v, unsigned n) { return (v << n) | (v >> (32 - n)); }

static void sha1_block(hpr_sha1_t *s, const uint8_t block[64]) {
    uint32_t w[80];
    for (int i = 0; i < 16; i++) {
        w[i] = ((uint32_t) block[4*i] << 24) | ((uint32_t) block[4*i+1] << 16) |
               ((uint32_t) block[4*i+2] << 8) | block[4*i+3];
    }
    for (int i = 16; i < 80; i++) w[i] = rol32(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
    uint32_t a=s->h[0], b=s->h[1], c=s->h[2], d=s->h[3], e=s->h[4];
    for (int i = 0; i < 80; i++) {
        uint32_t f, k;
        if (i < 20) { f = (b & c) | ((~b) & d); k = 0x5A827999u; }
        else if (i < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1u; }
        else if (i < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDCu; }
        else { f = b ^ c ^ d; k = 0xCA62C1D6u; }
        uint32_t t = rol32(a,5) + f + e + k + w[i];
        e=d; d=c; c=rol32(b,30); b=a; a=t;
    }
    s->h[0]+=a; s->h[1]+=b; s->h[2]+=c; s->h[3]+=d; s->h[4]+=e;
}

static void sha1_init(hpr_sha1_t *s) {
    memset(s, 0, sizeof(*s));
    s->h[0]=0x67452301u; s->h[1]=0xEFCDAB89u; s->h[2]=0x98BADCFEu; s->h[3]=0x10325476u; s->h[4]=0xC3D2E1F0u;
}

static void sha1_update(hpr_sha1_t *s, const uint8_t *p, size_t n) {
    s->bits += (uint64_t)n * 8u;
    while (n) {
        size_t take = 64 - s->used;
        if (take > n) take = n;
        memcpy(s->block + s->used, p, take);
        s->used += take; p += take; n -= take;
        if (s->used == 64) { sha1_block(s, s->block); s->used = 0; }
    }
}

static void sha1_final(hpr_sha1_t *s, uint8_t out[20]) {
    uint64_t bits = s->bits;
    uint8_t one = 0x80, zero = 0;
    sha1_update(s, &one, 1);
    while (s->used != 56) sha1_update(s, &zero, 1);
    uint8_t len[8];
    for (int i = 0; i < 8; i++) len[7-i] = (uint8_t)(bits >> (i*8));
    sha1_update(s, len, 8);
    for (int i = 0; i < 5; i++) {
        out[4*i] = (uint8_t)(s->h[i] >> 24); out[4*i+1] = (uint8_t)(s->h[i] >> 16);
        out[4*i+2] = (uint8_t)(s->h[i] >> 8); out[4*i+3] = (uint8_t)s->h[i];
    }
}

static void b64_20(const uint8_t in[20], char out[29]) {
    static const char t[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    size_t j = 0;
    for (size_t i = 0; i < 18; i += 3) {
        uint32_t v = ((uint32_t)in[i] << 16) | ((uint32_t)in[i+1] << 8) | in[i+2];
        out[j++] = t[(v >> 18) & 63]; out[j++] = t[(v >> 12) & 63]; out[j++] = t[(v >> 6) & 63]; out[j++] = t[v & 63];
    }
    uint32_t v = (uint32_t)in[18] << 16 | (uint32_t)in[19] << 8;
    out[j++] = t[(v >> 18) & 63]; out[j++] = t[(v >> 12) & 63]; out[j++] = t[(v >> 6) & 63]; out[j++] = '=';
    out[j] = '\0';
}

static int set_nonblock(int fd) {
    int flags = fcntl(fd, F_GETFL, 0);
    return flags < 0 ? -1 : fcntl(fd, F_SETFL, flags | O_NONBLOCK);
}

static int ws_send(int fd, uint8_t opcode, const uint8_t *payload, size_t len) {
    uint8_t *frame = malloc(len + 10);
    if (!frame) return -1;
    size_t h = 0;
    frame[h++] = (uint8_t)(0x80u | opcode);
    if (len < 126) {
        frame[h++] = (uint8_t)len;
    } else if (len <= 0xffffu) {
        frame[h++] = 126; frame[h++] = (uint8_t)(len >> 8); frame[h++] = (uint8_t)len;
    } else {
        frame[h++] = 127;
        uint64_t n = len;
        for (int i = 7; i >= 0; i--) frame[h++] = (uint8_t)(n >> (i*8));
    }
    if (len) memcpy(frame + h, payload, len);
    ssize_t n = send(fd, frame, h + len, MSG_NOSIGNAL);
    free(frame);
    return n == (ssize_t)(h + len) ? 0 : -1;
}

static char *trim_header_value(char *p) {
    while (*p == ' ' || *p == '\t') p++;
    char *e = strstr(p, "\r\n");
    if (e) *e = '\0';
    return p;
}

static int ws_handshake(int fd) {
    char req[4096];
    size_t used = 0;
    struct timeval tv = {.tv_sec = 2, .tv_usec = 0};
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    while (used + 1 < sizeof(req)) {
        ssize_t n = recv(fd, req + used, sizeof(req) - used - 1, 0);
        if (n <= 0) return -1;
        used += (size_t)n; req[used] = '\0';
        if (strstr(req, "\r\n\r\n")) break;
    }
    if (strncmp(req, "GET /ws/air ", 12) != 0 && strncmp(req, "GET /ws/air?", 12) != 0) return -1;
    char *key = strcasestr(req, "\r\nSec-WebSocket-Key:");
    if (!key) return -1;
    key = trim_header_value(key + strlen("\r\nSec-WebSocket-Key:"));
    if (!*key) return -1;

    char material[256];
    int m = snprintf(material, sizeof(material), "%s258EAFA5-E914-47DA-95CA-C5AB0DC85B11", key);
    if (m <= 0 || (size_t)m >= sizeof(material)) return -1;
    hpr_sha1_t sha; uint8_t digest[20]; char accept[29];
    sha1_init(&sha); sha1_update(&sha, (const uint8_t *)material, (size_t)m); sha1_final(&sha, digest); b64_20(digest, accept);

    char resp[256];
    int r = snprintf(resp, sizeof(resp),
        "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: %s\r\n\r\n", accept);
    if (r <= 0 || (size_t)r >= sizeof(resp)) return -1;
    if (send(fd, resp, (size_t)r, MSG_NOSIGNAL) != r) return -1;
    return set_nonblock(fd);
}

static int cache_find(uint32_t icao) {
    for (size_t i = 0; i < hpr_cache_len; i++) if (hpr_cache[i].icao == icao) return (int)i;
    return -1;
}

static int client_knows(const hpr_ws_client_t *c, uint32_t icao) {
    for (size_t i = 0; i < c->known_len; i++) if (c->known[i] == icao) return 1;
    return 0;
}

static void client_mark_known(hpr_ws_client_t *c, uint32_t icao) {
    if (client_knows(c, icao) || c->known_len >= HPR_WS_CACHE_MAX) return;
    c->known[c->known_len++] = icao;
}

static int bbox_match(const hpr_ws_client_t *c, int have_pos, double lat, double lon) {
    if (!c->bbox_set) return 1;
    if (!have_pos || lat < c->south || lat > c->north) return 0;
    if (c->west <= c->east) return lon >= c->west && lon <= c->east;
    return lon >= c->west || lon <= c->east;
}

static void client_close(hpr_ws_client_t *c) {
    if (c->fd >= 0) close(c->fd);
    memset(c, 0, sizeof(*c)); c->fd = -1;
}

static int send_snapshot(hpr_ws_client_t *c) {
    uint8_t *out = malloc(HPR_WS_PAYLOAD_MAX);
    if (!out) return -1;
    size_t used = 0;
    c->known_len = 0;
    for (size_t i = 0; i < hpr_cache_len; i++) {
        hpr_ws_cache_t *x = &hpr_cache[i];
        if (!bbox_match(c, x->have_pos, x->lat, x->lon)) continue;
        if (x->have_pos && used + HPR_AIRWIRE_POS_SIZE <= HPR_WS_PAYLOAD_MAX) {
            memcpy(out + used, x->pos, HPR_AIRWIRE_POS_SIZE); used += HPR_AIRWIRE_POS_SIZE;
        }
        if (used + HPR_AIRWIRE_IDENT_SIZE <= HPR_WS_PAYLOAD_MAX) {
            memcpy(out + used, x->ident, HPR_AIRWIRE_IDENT_SIZE); used += HPR_AIRWIRE_IDENT_SIZE;
            client_mark_known(c, x->icao);
        }
    }
    int rc = ws_send(c->fd, 0x2, out, used);
    free(out);
    return rc;
}

static int parse_bbox(hpr_ws_client_t *c, const char *text) {
    double s,n,w,e,z;
    int fields = sscanf(text, "box:%lf,%lf,%lf,%lf,%lf", &s,&n,&w,&e,&z);
    if (fields != 4 && fields != 5) return -1;
    if (s < -90 || s > 90 || n < -90 || n > 90 || s > n || w < -180 || w > 180 || e < -180 || e > 180) return -1;
    c->south=s; c->north=n; c->west=w; c->east=e; c->bbox_set=1;
    return send_snapshot(c);
}

static int client_read(hpr_ws_client_t *c) {
    for (;;) {
        if (c->rx_len == sizeof(c->rx)) return -1;
        ssize_t n = recv(c->fd, c->rx + c->rx_len, sizeof(c->rx) - c->rx_len, 0);
        if (n > 0) { c->rx_len += (size_t)n; continue; }
        if (n == 0) return -1;
        if (errno == EAGAIN || errno == EWOULDBLOCK) break;
        return -1;
    }
    while (c->rx_len >= 2) {
        const uint8_t *p = c->rx;
        uint8_t opcode = p[0] & 0x0f;
        if ((p[0] & 0x80) == 0) return -1;
        int masked = (p[1] & 0x80) != 0;
        uint64_t len = p[1] & 0x7f;
        size_t off = 2;
        if (len == 126) {
            if (c->rx_len < 4) break;
            len = ((uint64_t)p[2] << 8) | p[3]; off = 4;
        } else if (len == 127) {
            return -1;
        }
        if (!masked || len > 256) return -1;
        if (c->rx_len < off + 4 + len) break;
        const uint8_t *mask = p + off; off += 4;
        uint8_t msg[257];
        for (size_t i = 0; i < (size_t)len; i++) msg[i] = p[off+i] ^ mask[i&3];
        msg[len] = 0;
        size_t consumed = off + (size_t)len;
        if (opcode == 0x8) return -1;
        if (opcode == 0x9) { if (ws_send(c->fd, 0xA, msg, (size_t)len) < 0) return -1; }
        if (opcode == 0x1 && parse_bbox(c, (const char *)msg) < 0) return -1;
        memmove(c->rx, c->rx + consumed, c->rx_len - consumed); c->rx_len -= consumed;
    }
    return 0;
}

static void map_aircraft(struct aircraft *a, hpr_airwire_position_t *p, hpr_airwire_identity_t *id, int *have_pos) {
    memset(p, 0, sizeof(*p)); memset(id, 0, sizeof(*id));
    uint32_t icao = a->addr & 0xFFFFFFu;
    p->icao = id->icao = icao;
    *have_pos = trackDataValid(&a->pos_reliable_valid);
    if (*have_pos) { p->lat_deg = a->latReliable; p->lon_deg = a->lonReliable; }
    if (altBaroReliable(a)) p->altitude_ft = a->baro_alt;
    else if (trackDataValid(&a->geom_alt_valid)) p->altitude_ft = a->geom_alt;
    if (trackDataValid(&a->track_valid)) p->track_deg = a->track;
    if (trackDataValid(&a->gs_valid)) p->ground_speed_kt = a->gs;
    if (trackDataValid(&a->baro_rate_valid)) p->vertical_rate_fpm = a->baro_rate;
    else if (trackDataValid(&a->geom_rate_valid)) p->vertical_rate_fpm = a->geom_rate;

    if (trackDataValid(&a->callsign_valid)) {
        size_t n = 0; while (n < 8 && a->callsign[n]) { id->callsign[n] = a->callsign[n]; n++; }
        while (n > 0 && id->callsign[n-1] == ' ') id->callsign[--n] = '\0';
    }
    id->category = (uint8_t)(a->category & 0xFFu);
    if (trackDataValid(&a->squawk_valid)) id->squawk = (uint16_t)(a->squawk & 0xFFFFu);
}

static size_t scan_changes(hpr_ws_change_t *changes, int64_t now) {
    size_t nchanges = 0;
    struct craftArray *ca = &Modes.aircraftActive;
    ca_lock_read(ca);
    for (int i = 0; i < ca->len; i++) {
        struct aircraft *a = ca->list[i];
        if (!a || !includeAircraftJson(now, a)) continue;
        if (a->addr & MODES_NON_ICAO_ADDRESS) continue;
        uint32_t icao = a->addr & 0xFFFFFFu;
        if (!icao) continue;
        int idx = cache_find(icao);
        if (idx < 0) {
            if (hpr_cache_len >= HPR_WS_CACHE_MAX) continue;
            idx = (int)hpr_cache_len++; memset(&hpr_cache[idx], 0, sizeof(hpr_cache[idx])); hpr_cache[idx].icao = icao;
        }
        hpr_ws_cache_t *x = &hpr_cache[idx];
        hpr_airwire_position_t p; hpr_airwire_identity_t id; int have_pos = 0;
        map_aircraft(a, &p, &id, &have_pos);
        uint8_t pos[HPR_AIRWIRE_POS_SIZE], ident[HPR_AIRWIRE_IDENT_SIZE];
        int pos_ok = have_pos && hpr_airwire_encode_position(pos, &p);
        int id_ok = hpr_airwire_encode_identity(ident, &id);
        int pos_changed = pos_ok && (!x->have_pos || memcmp(x->pos, pos, sizeof(pos)) != 0 || now - x->last_pos_sent_ms >= HPR_WS_REFRESH_MS);
        int id_changed = id_ok && (x->last_seen_ms == 0 || memcmp(x->ident, ident, sizeof(ident)) != 0);
        x->last_seen_ms = now; x->have_pos = pos_ok; x->lat = p.lat_deg; x->lon = p.lon_deg;
        if (pos_ok) memcpy(x->pos, pos, sizeof(pos));
        if (id_ok) memcpy(x->ident, ident, sizeof(ident));
        if (pos_changed) x->last_pos_sent_ms = now;
        if ((pos_changed || id_changed) && nchanges < HPR_WS_CACHE_MAX) {
            hpr_ws_change_t *ch = &changes[nchanges++]; memset(ch, 0, sizeof(*ch));
            ch->icao=icao; ch->pos_changed=pos_changed; ch->ident_changed=id_changed; ch->have_pos=pos_ok; ch->lat=x->lat; ch->lon=x->lon;
            if (pos_ok) memcpy(ch->pos, x->pos, sizeof(ch->pos));
            if (id_ok) memcpy(ch->ident, x->ident, sizeof(ch->ident));
        }
    }
    ca_unlock_read(ca);

    for (size_t i = 0; i < hpr_cache_len;) {
        if (now - hpr_cache[i].last_seen_ms > HPR_WS_STALE_MS) {
            hpr_cache[i] = hpr_cache[hpr_cache_len - 1]; hpr_cache_len--; continue;
        }
        i++;
    }
    return nchanges;
}

static int send_changes(hpr_ws_client_t *c, const hpr_ws_change_t *changes, size_t count) {
    uint8_t *out = malloc(HPR_WS_PAYLOAD_MAX);
    if (!out) return -1;
    size_t used = 0;
    for (size_t i = 0; i < count; i++) {
        const hpr_ws_change_t *ch = &changes[i];
        if (!bbox_match(c, ch->have_pos, ch->lat, ch->lon)) continue;
        if (ch->pos_changed) {
            if (used + HPR_AIRWIRE_POS_SIZE > HPR_WS_PAYLOAD_MAX) break;
            memcpy(out + used, ch->pos, HPR_AIRWIRE_POS_SIZE); used += HPR_AIRWIRE_POS_SIZE;
            if (!client_knows(c, ch->icao)) {
                if (used + HPR_AIRWIRE_IDENT_SIZE > HPR_WS_PAYLOAD_MAX) break;
                memcpy(out + used, ch->ident, HPR_AIRWIRE_IDENT_SIZE); used += HPR_AIRWIRE_IDENT_SIZE;
                client_mark_known(c, ch->icao);
            }
        } else if (ch->ident_changed && client_knows(c, ch->icao)) {
            if (used + HPR_AIRWIRE_IDENT_SIZE > HPR_WS_PAYLOAD_MAX) break;
            memcpy(out + used, ch->ident, HPR_AIRWIRE_IDENT_SIZE); used += HPR_AIRWIRE_IDENT_SIZE;
        } else if (ch->ident_changed && !c->bbox_set) {
            if (used + HPR_AIRWIRE_IDENT_SIZE > HPR_WS_PAYLOAD_MAX) break;
            memcpy(out + used, ch->ident, HPR_AIRWIRE_IDENT_SIZE); used += HPR_AIRWIRE_IDENT_SIZE;
            client_mark_known(c, ch->icao);
        }
    }
    int rc = used ? ws_send(c->fd, 0x2, out, used) : 0;
    free(out);
    return rc;
}

static int make_listener(void) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return -1;
    int one = 1; setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
    struct sockaddr_in sa; memset(&sa, 0, sizeof(sa)); sa.sin_family = AF_INET; sa.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    const char *v = getenv("HPR_AIRWIRE_WS_PORT");
    long port = v && *v ? strtol(v, NULL, 10) : HPR_WS_DEFAULT_PORT;
    if (port < 1 || port > 65535) port = HPR_WS_DEFAULT_PORT;
    sa.sin_port = htons((uint16_t)port);
    if (bind(fd, (struct sockaddr *)&sa, sizeof(sa)) < 0 || listen(fd, HPR_WS_MAX_CLIENTS) < 0 || set_nonblock(fd) < 0) { close(fd); return -1; }
    fprintf(stderr, "HPR AirWire binary WS: http://127.0.0.1:%ld/ws/air\n", port);
    return fd;
}

static void *ws_thread(void *unused) {
    MODES_NOTUSED(unused);
    int listener = make_listener();
    if (listener < 0) { fprintf(stderr, "HPR AirWire WS: listener start failed: %s\n", strerror(errno)); return NULL; }
    hpr_ws_client_t clients[HPR_WS_MAX_CLIENTS];
    for (int i = 0; i < HPR_WS_MAX_CLIENTS; i++) { memset(&clients[i], 0, sizeof(clients[i])); clients[i].fd = -1; }
    hpr_ws_change_t changes[HPR_WS_CACHE_MAX];
    int64_t next_scan = mstime();

    while (!Modes.exitSoon) {
        struct pollfd pfds[1 + HPR_WS_MAX_CLIENTS]; int map[1 + HPR_WS_MAX_CLIENTS];
        int nfds = 1; pfds[0] = (struct pollfd){.fd=listener,.events=POLLIN}; map[0] = -1;
        for (int i = 0; i < HPR_WS_MAX_CLIENTS; i++) if (clients[i].fd >= 0) {
            pfds[nfds] = (struct pollfd){.fd=clients[i].fd,.events=POLLIN}; map[nfds++] = i;
        }
        poll(pfds, (nfds_t)nfds, 50);
        if (pfds[0].revents & POLLIN) {
            int fd = accept(listener, NULL, NULL);
            if (fd >= 0) {
                int slot = -1; for (int i = 0; i < HPR_WS_MAX_CLIENTS; i++) if (clients[i].fd < 0) { slot = i; break; }
                if (slot < 0 || ws_handshake(fd) < 0) close(fd);
                else { clients[slot].fd = fd; if (send_snapshot(&clients[slot]) < 0) client_close(&clients[slot]); }
            }
        }
        for (int p = 1; p < nfds; p++) if (pfds[p].revents) {
            int i = map[p];
            if ((pfds[p].revents & (POLLERR|POLLHUP|POLLNVAL)) || client_read(&clients[i]) < 0) client_close(&clients[i]);
        }
        int64_t now = mstime();
        if (now >= next_scan) {
            size_t n = scan_changes(changes, now);
            if (n) for (int i = 0; i < HPR_WS_MAX_CLIENTS; i++) if (clients[i].fd >= 0 && send_changes(&clients[i], changes, n) < 0) client_close(&clients[i]);
            next_scan = now + HPR_WS_SCAN_MS;
        }
    }
    for (int i = 0; i < HPR_WS_MAX_CLIENTS; i++) client_close(&clients[i]);
    close(listener);
    return NULL;
}

static void start_once(void) {
    pthread_t tid;
    int rc = pthread_create(&tid, NULL, ws_thread, NULL);
    if (rc == 0) pthread_detach(tid);
    else fprintf(stderr, "HPR AirWire WS: pthread_create failed: %s\n", strerror(rc));
}

void hprAirWireWsStart(void) { pthread_once(&hpr_ws_once, start_once); }
