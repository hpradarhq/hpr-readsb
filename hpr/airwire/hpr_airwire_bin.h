#ifndef HPR_AIRWIRE_BIN_H
#define HPR_AIRWIRE_BIN_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define HPR_AIRWIRE_POS_TYPE 0x02u
#define HPR_AIRWIRE_POS_SIZE 20u
#define HPR_AIRWIRE_IDENT_TYPE 0x06u
#define HPR_AIRWIRE_IDENT_SIZE 15u
#define HPR_AIRWIRE_META_TYPE 0x0Au
#define HPR_AIRWIRE_META_SIZE 20u

typedef struct {
    uint32_t icao;
    double lon_deg;
    double lat_deg;
    int32_t altitude_ft;
    double track_deg;
    double ground_speed_kt;
    int32_t vertical_rate_fpm;
} hpr_airwire_position_t;

typedef struct {
    uint32_t icao;
    char callsign[9];
    uint8_t category;
    uint16_t squawk;
} hpr_airwire_identity_t;

typedef struct {
    uint32_t icao;
    char type_code[5];
    char registration[13];
} hpr_airwire_metadata_t;

bool hpr_airwire_encode_position(uint8_t out[HPR_AIRWIRE_POS_SIZE], const hpr_airwire_position_t *in);
bool hpr_airwire_encode_identity(uint8_t out[HPR_AIRWIRE_IDENT_SIZE], const hpr_airwire_identity_t *in);
bool hpr_airwire_encode_metadata(uint8_t out[HPR_AIRWIRE_META_SIZE], const hpr_airwire_metadata_t *in);

#endif
