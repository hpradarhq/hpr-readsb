# E7 — Physical Edge vs tar1090 benchmark

E7 is the release gate for the claim that HPRadar Edge is materially better than tar1090 for a **local ADS-B edge station**.

Static feature scores are not E7. Use the same Pi class, browser/device, receiver/RF input, map area and similar aircraft count.

## Scope

Edge is intentionally designed for **<=400 aircraft**. No clustering and no LOD are part of this benchmark.

Eight operator tasks are measured:

1. Find a named aircraft.
2. Show rotorcraft only.
3. Show emergency aircraft.
4. Open selected aircraft detail.
5. Show the selected aircraft's real readsb trace.
6. Start and scrub replay.
7. Show all recent tracks.
8. Show receiver coverage.

## 1. HPR Edge browser capture

Open Edge with benchmark mode enabled:

```text
http://<edge-pi>:8080/?bench=1
```

For every task:

1. Select the task.
2. Press **Start**.
3. Perform the task normally.
4. Press **Done** when the requested information/action is visible and usable.
5. Press **Fail** if the task cannot be completed.

Export the JSON after all eight tasks.

Recommended: perform three complete runs and use the same browser/device for both systems. The comparator uses median task results when multiple runs of a task exist in one export.

## 2. tar1090 browser capture

Open tar1090 on the same browser/device.

Paste `tools/e7-manual-capture.js` into DevTools Console. Optionally set:

```js
window.E7_SUITE = 'tar1090';
```

before pasting the helper.

Perform the same eight tasks and export the JSON.

Do not change task definitions to favor either UI.

## 3. Pi resource sampling

Run the sampler on the host immediately before the eight tasks and stop it immediately after browser export:

```bash
chmod +x tools/e7-pi-sample.sh
./tools/e7-pi-sample.sh hpr-edge edge-pi.csv
```

For tar1090, use its actual container name:

```bash
./tools/e7-pi-sample.sh tar1090 tar-pi.csv
```

The sampler records one-second Docker CPU, memory, network I/O, block I/O and PID observations outside the tested container.

## 4. Compare

Browser-only comparison:

```bash
python3 test/e7_compare.py edge.json tar1090.json
```

Browser + Pi resource comparison:

```bash
python3 test/e7_compare.py edge.json tar1090.json \
  --edge-pi edge-pi.csv \
  --tar-pi tar-pi.csv
```

## Pass rule

- All eight core tasks must succeed on both systems.
- No Edge task may be more than 20% slower than tar1090.
- Composite score must be **>=130** with tar1090 normalized to 100.

When Pi CSVs are provided the composite includes CPU, RAM and network efficiency. Without them, the comparator clearly reports that resource score is unavailable.

## Fair-test rules

- Same browser/device and similar map viewport.
- Same receiver/RF input, or the same deterministic replay input.
- Same warm/cold-cache rule for both systems.
- Do not count setup work that is outside the eight tasks for one UI but not the other.
- Restart both candidates before boot/first-aircraft measurement.
- Do not promote `:edge` based on static capability score alone.

## Promotion

Candidate tag: `edge-ux`.

Promote to stable `:edge` only after E7 physical PASS and visual acceptance on the Pi.
