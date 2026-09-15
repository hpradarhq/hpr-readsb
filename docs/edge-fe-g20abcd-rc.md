# G20A-D to G21 release candidate

Candidate: FE `4.7.5-edge.rc1`, build `260915.rc1`, branch `feat/edge-e1-e7-ux`.

G20A restores Atlas aircraft silhouettes at operational zoom and uses collision-decluttered status dots only at low zoom. Selected aircraft remain visible one LOD longer. No clustering.

G20B-D re-gate the already implemented map/display, station/admin/feed, and cross-gate UX contracts. Existing Chromium regression and 400-aircraft soak remain authoritative.

G21 requires static/runtime/admin/Chromium/AirWire/readsb/400-aircraft tests to pass and arm64 + armv7 image build/push as `edge-ux`.

Stable `edge` is not promoted. Physical acceptance is one final eyeball test only after CI confirms the G21 RC image was pushed.
