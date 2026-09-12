#include "hpr_airwire.h"

#include <stdarg.h>

#define HPR_AIRWIRE_ROW_BUDGET 512

#define HPR_AIRWIRE_FLAG_GROUND       0x01u
#define HPR_AIRWIRE_FLAG_ALERT        0x02u
#define HPR_AIRWIRE_FLAG_SPI          0x04u
#define HPR_AIRWIRE_FLAG_NON_ICAO     0x08u
#define HPR_AIRWIRE_FLAG_POSITION     0x10u
#define HPR_AIRWIRE_FLAG_POSITION_MLAT 0x20u

typedef struct {
    char *buf;
    size_t cap;
    size_t len;
    int failed;
} aw_writer_t;

static void aw_vprintf(aw_writer_t *w, const char *fmt, va_list ap) {
    if (w->failed || w->len >= w->cap) {
        w->failed = 1;
        return;
    }

    size_t remaining = w->cap - w->len;
    int n = vsnprintf(w->buf + w->len, remaining, fmt, ap);
    if (n < 0 || (size_t) n >= remaining) {
        w->failed = 1;
        if (w->cap) {
            w->buf[w->cap - 1] = '\0';
        }
        return;
    }

    w->len += (size_t) n;
}

__attribute__ ((format(printf, 2, 3)))
static void aw_printf(aw_writer_t *w, const char *fmt, ...) {
    va_list ap;
    va_start(ap, fmt);
    aw_vprintf(w, fmt, ap);
    va_end(ap);
}

static void aw_putc(aw_writer_t *w, char ch) {
    if (w->failed || w->len + 1 >= w->cap) {
        w->failed = 1;
        return;
    }
    w->buf[w->len++] = ch;
    w->buf[w->len] = '\0';
}

static void aw_fixed_string_or_null(aw_writer_t *w, const char *value, size_t max_len, int valid) {
    if (!valid || !value) {
        aw_printf(w, "null");
        return;
    }

    size_t len = 0;
    while (len < max_len && value[len] != '\0') {
        len++;
    }
    while (len > 0 && value[len - 1] == ' ') {
        len--;
    }

    if (len == 0) {
        aw_printf(w, "null");
        return;
    }

    aw_putc(w, '"');
    for (size_t i = 0; i < len; i++) {
        unsigned char ch = (unsigned char) value[i];
        if (ch == '"' || ch == '\\') {
            aw_putc(w, '\\');
            aw_putc(w, (char) ch);
        } else if (ch < 0x20 || ch > 0x7e) {
            aw_printf(w, "\\u%04x", (unsigned) ch);
        } else {
            aw_putc(w, (char) ch);
        }
    }
    aw_putc(w, '"');
}

/* AirWire owns this enum. Do not expose addrtype_t numeric ABI directly. */
static unsigned aw_source_class(addrtype_t type) {
    switch (type) {
        case ADDR_ADSB_ICAO:       return 0;
        case ADDR_ADSB_ICAO_NT:    return 1;
        case ADDR_ADSR_ICAO:       return 2;
        case ADDR_TISB_ICAO:       return 3;
        case ADDR_JAERO:           return 4;
        case ADDR_MLAT:            return 5;
        case ADDR_OTHER:           return 6;
        case ADDR_MODE_S:          return 7;
        case ADDR_ADSB_OTHER:      return 8;
        case ADDR_ADSR_OTHER:      return 9;
        case ADDR_TISB_TRACKFILE:  return 10;
        case ADDR_TISB_OTHER:      return 11;
        case ADDR_MODE_A:          return 12;
        case ADDR_UNKNOWN:         return 13;
        default:                   return 13;
    }
}

static uint32_t aw_flags(struct aircraft *a) {
    uint32_t flags = 0;

    if (trackDataValid(&a->airground_valid) && a->airground == AG_GROUND) {
        flags |= HPR_AIRWIRE_FLAG_GROUND;
    }
    if (trackDataValid(&a->alert_valid) && a->alert) {
        flags |= HPR_AIRWIRE_FLAG_ALERT;
    }
    if (trackDataValid(&a->spi_valid) && a->spi) {
        flags |= HPR_AIRWIRE_FLAG_SPI;
    }
    if (a->addr & MODES_NON_ICAO_ADDRESS) {
        flags |= HPR_AIRWIRE_FLAG_NON_ICAO;
    }
    if (trackDataValid(&a->pos_reliable_valid)) {
        flags |= HPR_AIRWIRE_FLAG_POSITION;
        if (a->pos_reliable_valid.source == SOURCE_MLAT) {
            flags |= HPR_AIRWIRE_FLAG_POSITION_MLAT;
        }
    }

    return flags;
}

static double aw_rssi(struct aircraft *a) {
    double signal = 0.0;
    for (size_t i = 0; i < sizeof(a->signalLevel) / sizeof(a->signalLevel[0]); i++) {
        signal += a->signalLevel[i];
    }
    signal = signal / (sizeof(a->signalLevel) / sizeof(a->signalLevel[0])) + 1.125e-5;
    return 10.0 * log10(signal);
}

static void aw_aircraft_row(aw_writer_t *w, struct aircraft *a, int64_t now) {
    uint32_t flags = aw_flags(a);

    aw_printf(w, "[\"%06x\",%u,%u,",
            (unsigned) (a->addr & 0xFFFFFFu), aw_source_class(a->addrtype), flags);

    aw_fixed_string_or_null(w, a->callsign, sizeof(a->callsign), trackDataValid(&a->callsign_valid));
    aw_putc(w, ',');

    if (trackDataValid(&a->pos_reliable_valid)) {
        aw_printf(w, "%.6f,%.6f,", a->latReliable, a->lonReliable);
    } else {
        aw_printf(w, "null,null,");
    }

    if (altBaroReliable(a)) {
        aw_printf(w, "%d,", a->baro_alt);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->geom_alt_valid)) {
        aw_printf(w, "%d,", a->geom_alt);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->gs_valid)) {
        aw_printf(w, "%.1f,", a->gs);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->track_valid)) {
        aw_printf(w, "%.2f,", a->track);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->baro_rate_valid)) {
        aw_printf(w, "%d,", a->baro_rate);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->geom_rate_valid)) {
        aw_printf(w, "%d,", a->geom_rate);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->squawk_valid)) {
        aw_printf(w, "\"%04x\",", a->squawk);
    } else {
        aw_printf(w, "null,");
    }

    if (a->category != 0) {
        aw_printf(w, "%u,", a->category & 0xFFu);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->emergency_valid)) {
        aw_printf(w, "%u,", (unsigned) a->emergency);
    } else {
        aw_printf(w, "null,");
    }

    if (trackDataValid(&a->pos_reliable_valid)) {
        double seen_pos = now < a->pos_reliable_valid.updated ? 0.0 : (now - a->pos_reliable_valid.updated) / 1000.0;
        aw_printf(w, "%.3f,", seen_pos);
    } else {
        aw_printf(w, "null,");
    }

    double seen = now < a->seen ? 0.0 : (now - a->seen) / 1000.0;
    aw_printf(w, "%.3f,%.1f,", seen, aw_rssi(a));

    aw_fixed_string_or_null(w, a->registration, sizeof(a->registration), a->registration[0] != '\0');
    aw_putc(w, ',');
    aw_fixed_string_or_null(w, a->typeCode, sizeof(a->typeCode), a->typeCode[0] != '\0');

    aw_printf(w, ",%u,%u]", (unsigned) a->dbFlags, a->messages);
}

struct char_buffer hprGenerateAirWire(threadpool_buffer_t *pbuffer) {
    struct char_buffer cb = { 0 };
    int64_t now = mstime();
    struct craftArray *ca = &Modes.aircraftActive;

    ca_lock_read(ca);

    size_t alloc = 128 + ((size_t) ca->len + 16u) * HPR_AIRWIRE_ROW_BUDGET;
    char *buf = check_grow_threadpool_buffer_t(pbuffer, (ssize_t) alloc);
    aw_writer_t w = {
        .buf = buf,
        .cap = alloc,
        .len = 0,
        .failed = 0,
    };
    if (alloc) {
        buf[0] = '\0';
    }

    uint64_t total_messages = (uint64_t) Modes.stats_current.messages_total
            + (uint64_t) Modes.stats_alltime.messages_total;

    aw_printf(&w, "[%u,%" PRId64 ",%" PRIu64 ",[", HPR_AIRWIRE_VERSION, now, total_messages);

    int first = 1;
    for (int i = 0; i < ca->len; i++) {
        struct aircraft *a = ca->list[i];
        if (!a || !includeAircraftJson(now, a)) {
            continue;
        }

        if (!first) {
            aw_putc(&w, ',');
        }
        first = 0;
        aw_aircraft_row(&w, a, now);
    }

    aw_printf(&w, "]]\n");
    ca_unlock_read(ca);

    if (w.failed) {
        fprintf(stderr, "HPR AirWire: output buffer exhausted (allocated %zu bytes)\n", alloc);
        cb.buffer = buf;
        cb.len = 0;
        cb.alloc = alloc;
        return cb;
    }

    cb.buffer = buf;
    cb.len = w.len;
    cb.alloc = alloc;
    return cb;
}

struct char_buffer hprWriteJsonToFile(const char *dir, const char *file, struct char_buffer cb) {
    struct char_buffer result = writeJsonToFile(dir, file, cb);

    if (dir && file && strcmp(file, "aircraft.json") == 0) {
        static threadpool_buffer_t airwire_buffer = { 0 };
        struct char_buffer airwire = hprGenerateAirWire(&airwire_buffer);
        if (airwire.len > 0) {
            writeJsonToFile(dir, "airwire.json", airwire);
        }
    }

    return result;
}
