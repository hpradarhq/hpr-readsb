#include "hpr_airwire_bin.h"

#include <math.h>
#include <string.h>

static void put_u16le(uint8_t *p, uint16_t v) {
    p[0] = (uint8_t) v;
    p[1] = (uint8_t) (v >> 8);
}

static void put_i16le(uint8_t *p, int16_t v) {
    put_u16le(p, (uint16_t) v);
}

static void put_i32le(uint8_t *p, int32_t v) {
    uint32_t u = (uint32_t) v;
    p[0] = (uint8_t) u;
    p[1] = (uint8_t) (u >> 8);
    p[2] = (uint8_t) (u >> 16);
    p[3] = (uint8_t) (u >> 24);
}

static void put_u24le(uint8_t *p, uint32_t v) {
    p[0] = (uint8_t) v;
    p[1] = (uint8_t) (v >> 8);
    p[2] = (uint8_t) (v >> 16);
}

static int16_t clamp_i16(long long v) {
    if (v < -32768) return -32768;
    if (v > 32767) return 32767;
    return (int16_t) v;
}

static uint16_t clamp_u16(long long v) {
    if (v < 0) return 0;
    if (v > 65535) return 65535;
    return (uint16_t) v;
}

static bool valid_icao(uint32_t icao) {
    return icao > 0 && icao <= 0xFFFFFFu;
}

bool hpr_airwire_encode_position(uint8_t out[HPR_AIRWIRE_POS_SIZE], const hpr_airwire_position_t *in) {
    if (!out || !in || !valid_icao(in->icao)) return false;
    if (!isfinite(in->lon_deg) || !isfinite(in->lat_deg)) return false;
    if (in->lon_deg < -180.0 || in->lon_deg > 180.0 || in->lat_deg < -90.0 || in->lat_deg > 90.0) return false;

    double track = isfinite(in->track_deg) ? fmod(in->track_deg, 360.0) : 0.0;
    if (track < 0) track += 360.0;
    double gs = isfinite(in->ground_speed_kt) && in->ground_speed_kt > 0.0 ? in->ground_speed_kt : 0.0;

    memset(out, 0, HPR_AIRWIRE_POS_SIZE);
    out[0] = HPR_AIRWIRE_POS_TYPE;
    put_u24le(out + 1, in->icao);
    put_i32le(out + 4, (int32_t) llround(in->lon_deg * 600000.0));
    put_i32le(out + 8, (int32_t) llround(in->lat_deg * 600000.0));
    put_i16le(out + 12, clamp_i16(llround((double) in->altitude_ft / 25.0)));
    put_u16le(out + 14, clamp_u16(llround(track * 10.0)));
    put_u16le(out + 16, clamp_u16(llround(gs * 10.0)));
    put_i16le(out + 18, clamp_i16(in->vertical_rate_fpm));
    return true;
}

bool hpr_airwire_encode_identity(uint8_t out[HPR_AIRWIRE_IDENT_SIZE], const hpr_airwire_identity_t *in) {
    if (!out || !in || !valid_icao(in->icao)) return false;

    memset(out, 0, HPR_AIRWIRE_IDENT_SIZE);
    out[0] = HPR_AIRWIRE_IDENT_TYPE;
    put_u24le(out + 1, in->icao);
    for (size_t i = 0; i < 8 && in->callsign[i]; i++) {
        unsigned char ch = (unsigned char) in->callsign[i];
        out[4 + i] = (ch >= 0x20 && ch <= 0x7e) ? ch : (uint8_t) '?';
    }
    out[12] = in->category;
    put_u16le(out + 13, in->squawk);
    return true;
}
