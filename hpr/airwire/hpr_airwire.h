#ifndef HPR_AIRWIRE_H
#define HPR_AIRWIRE_H

#include "../../readsb.h"

#define HPR_AIRWIRE_VERSION 1

/* Generate one full AirWire snapshot from readsb's canonical aircraft state. */
struct char_buffer hprGenerateAirWire(threadpool_buffer_t *pbuffer);

/*
 * G1 integration hook. It preserves upstream writeJsonToFile behavior and
 * emits airwire.json when the normal aircraft snapshot is written.
 */
struct char_buffer hprWriteJsonToFile(const char *dir, const char *file, struct char_buffer cb);

#endif
