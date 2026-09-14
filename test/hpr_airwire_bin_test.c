#include "../hpr/airwire/hpr_airwire_bin.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void require_bytes(const char *name, const uint8_t *got, const uint8_t *want, size_t n) {
    if (memcmp(got, want, n) == 0) return;
    fprintf(stderr, "%s mismatch\n got: ", name);
    for (size_t i = 0; i < n; i++) fprintf(stderr, "%02x", got[i]);
    fprintf(stderr, "\nwant: ");
    for (size_t i = 0; i < n; i++) fprintf(stderr, "%02x", want[i]);
    fprintf(stderr, "\n");
    exit(1);
}

static void require_true(const char *name, int v) {
    if (!v) { fprintf(stderr, "%s failed\n", name); exit(1); }
}

static void require_false(const char *name, int v) {
    if (v) { fprintf(stderr, "%s unexpectedly passed\n", name); exit(1); }
}

int main(void) {
    uint8_t out[HPR_AIRWIRE_POS_SIZE];
    const hpr_airwire_position_t p = {
        .icao = 0xABCDEF, .lon_deg = 106.812345, .lat_deg = 20.912345,
        .altitude_ft = 35000, .track_deg = 90.1, .ground_speed_kt = 123.4,
        .vertical_rate_fpm = -640,
    };
    const uint8_t pos_golden[HPR_AIRWIRE_POS_SIZE] = {
        0x02,0xef,0xcd,0xab,0x6f,0xe5,0xd1,0x03,0x4f,0x75,0xbf,0x00,0x78,0x05,0x85,0x03,0xd2,0x04,0x80,0xfd
    };
    require_true("position golden encode", hpr_airwire_encode_position(out, &p));
    require_bytes("position golden", out, pos_golden, sizeof(pos_golden));

    const hpr_airwire_identity_t id = {
        .icao = 0xABCDEF, .callsign = "HVN123", .category = 0xA3, .squawk = 0x1234,
    };
    const uint8_t id_golden[HPR_AIRWIRE_IDENT_SIZE] = {
        0x06,0xef,0xcd,0xab,0x48,0x56,0x4e,0x31,0x32,0x33,0x00,0x00,0xa3,0x34,0x12
    };
    uint8_t id_out[HPR_AIRWIRE_IDENT_SIZE];
    require_true("identity golden encode", hpr_airwire_encode_identity(id_out, &id));
    require_bytes("identity golden", id_out, id_golden, sizeof(id_golden));

    const hpr_airwire_metadata_t meta = {
        .icao = 0xABCDEF, .type_code = "A320", .registration = "VN-A123",
    };
    const uint8_t meta_golden[HPR_AIRWIRE_META_SIZE] = {
        0x0a,0xef,0xcd,0xab,0x41,0x33,0x32,0x30,0x56,0x4e,0x2d,0x41,0x31,0x32,0x33,0x00,0x00,0x00,0x00,0x00
    };
    uint8_t meta_out[HPR_AIRWIRE_META_SIZE];
    require_true("metadata golden encode", hpr_airwire_encode_metadata(meta_out, &meta));
    require_bytes("metadata golden", meta_out, meta_golden, sizeof(meta_golden));

    hpr_airwire_position_t negative = {
        .icao = 1, .lon_deg = -115.0, .lat_deg = -36.0,
        .altitude_ft = -200, .track_deg = -1.0, .ground_speed_kt = 7000.0,
        .vertical_rate_fpm = -50000,
    };
    require_true("negative/saturated position", hpr_airwire_encode_position(out, &negative));
    require_true("negative lon sign", (out[7] & 0x80) != 0);
    require_true("negative lat sign", (out[11] & 0x80) != 0);
    require_true("track normalization", out[14] == 0x06 && out[15] == 0x0e);
    require_true("gs saturation", out[16] == 0xff && out[17] == 0xff);
    require_true("vr saturation", out[18] == 0x00 && out[19] == 0x80);

    hpr_airwire_identity_t padded = {.icao = 0x123456, .callsign = "AB", .category = 0, .squawk = 0};
    require_true("callsign padding", hpr_airwire_encode_identity(id_out, &padded));
    for (size_t i = 6; i < 12; i++) require_true("callsign nul pad", id_out[i] == 0);

    hpr_airwire_position_t bad = p;
    bad.icao = 0;
    require_false("zero icao", hpr_airwire_encode_position(out, &bad));
    bad = p;
    bad.lat_deg = 91.0;
    require_false("invalid latitude", hpr_airwire_encode_position(out, &bad));

    puts("hpr_airwire_bin_test: PASS");
    return 0;
}
