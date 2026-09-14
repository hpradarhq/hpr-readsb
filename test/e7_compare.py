#!/usr/bin/env python3
"""Compare E7 operator benchmark exports.

Usage:
  python3 test/e7_compare.py edge.json tar1090.json

Tar1090 is normalized to 100. PASS requires every core task to succeed on both
systems, Edge to have no >20% regression on any individual task, and composite
score >=130.
"""
import json, math, statistics, sys
from pathlib import Path

TASKS = [
    'find_aircraft','filter_rotor','find_emergency','open_detail',
    'show_trace','replay','all_tracks','coverage'
]

def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

def index_runs(doc):
    out = {}
    for r in doc.get('runs', []):
        if r.get('task') in TASKS and r.get('ok'):
            out.setdefault(r['task'], []).append(r)
    return out

def med(rows, key):
    vals=[float(r[key]) for r in rows if r.get(key) is not None]
    return statistics.median(vals) if vals else None

def ratio(base, candidate):
    if base is None or candidate is None or candidate <= 0:
        return None
    return base / candidate

def capped(v, lo=0.5, hi=2.0):
    return min(hi, max(lo, v))

def main(edge_path, tar_path):
    edge, tar = load(edge_path), load(tar_path)
    er, tr = index_runs(edge), index_runs(tar)
    missing=[]
    time_ratios=[]; click_ratios=[]; worst=10.0
    print('E7 task comparison (tar1090 = 100)')
    print(f"{'task':18s} {'edge_s':>8s} {'tar_s':>8s} {'ratio':>7s} {'edge_click':>10s} {'tar_click':>9s}")
    for task in TASKS:
        if task not in er or task not in tr:
            missing.append(task);continue
        ems,tms=med(er[task],'ms'),med(tr[task],'ms')
        ec,tc=med(er[task],'clicks'),med(tr[task],'clicks')
        r=ratio(tms,ems);cr=ratio(tc if tc and tc>0 else 1,ec if ec and ec>0 else 1)
        if r is not None:
            time_ratios.append(capped(r));worst=min(worst,r)
        if cr is not None: click_ratios.append(capped(cr))
        print(f"{task:18s} {ems/1000:8.2f} {tms/1000:8.2f} {r:7.2f} {ec:10.1f} {tc:9.1f}")
    if missing:
        print('MISSING:', ', '.join(missing), file=sys.stderr);return 2
    time_score=100*statistics.mean(time_ratios)
    click_score=100*statistics.mean(click_ratios) if click_ratios else 100.0
    boot_ratio=ratio(tar.get('firstAircraftMs'),edge.get('firstAircraftMs'))
    if boot_ratio is not None:
        boot_score=100*capped(boot_ratio)
        composite=.70*time_score+.20*click_score+.10*boot_score
    else:
        boot_score=None;composite=.80*time_score+.20*click_score
    print(f'\nTask-time score : {time_score:.1f}')
    print(f'Click score     : {click_score:.1f}')
    print(f'Boot score      : {boot_score:.1f}' if boot_score is not None else 'Boot score      : n/a')
    print(f'Worst task ratio: {worst:.2f}x')
    print(f'COMPOSITE       : {composite:.1f} (target >=130)')
    # No core task may be >20% slower even if other tasks are much faster.
    ok = composite >= 130 and worst >= (1/1.20)
    print('RESULT          :', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1

if __name__=='__main__':
    if len(sys.argv)!=3:
        print(__doc__.strip(), file=sys.stderr);sys.exit(2)
    sys.exit(main(Path(sys.argv[1]),Path(sys.argv[2])))
