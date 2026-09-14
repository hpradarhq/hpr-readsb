#!/usr/bin/env python3
"""Compare E7 operator benchmark exports.

Usage:
  python3 test/e7_compare.py edge.json tar1090.json
  python3 test/e7_compare.py edge.json tar1090.json \
      --edge-pi edge-pi.csv --tar-pi tar-pi.csv

Tar1090 is normalized to 100. PASS requires every core task to succeed on both
systems, Edge to have no >20% regression on any individual task, and composite
score >=130. Pi resource samples are optional; when both are supplied they add
CPU/RAM/network efficiency to the composite instead of relying on UX alone.
"""
import argparse, csv, json, re, statistics, sys
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

def pct(v):
    try: return float(str(v).strip().rstrip('%'))
    except (TypeError, ValueError): return None

def bytes_value(v):
    if v is None: return None
    m=re.match(r'^\s*([0-9.]+)\s*([kMGT]?i?B)\s*$', str(v), re.I)
    if not m: return None
    n=float(m.group(1));u=m.group(2).upper()
    mult={'B':1,'KB':1e3,'MB':1e6,'GB':1e9,'TB':1e12,'KIB':1024,'MIB':1024**2,'GIB':1024**3,'TIB':1024**4}.get(u)
    return n*mult if mult else None

def net_total(v):
    if not v or '/' not in str(v): return None
    a,b=(x.strip() for x in str(v).split('/',1));av,bv=bytes_value(a),bytes_value(b)
    return av+bv if av is not None and bv is not None else None

def pi_stats(path):
    rows=[]
    with open(path, newline='', encoding='utf-8-sig') as f:
        for r in csv.DictReader(f):
            cpu=pct(r.get('cpu_percent'));mem=pct(r.get('mem_percent'));net=net_total(r.get('net_io'))
            if cpu is not None and mem is not None: rows.append({'cpu':cpu,'mem':mem,'net':net})
    if not rows: return None
    net_delta=None
    nets=[r['net'] for r in rows if r['net'] is not None]
    if len(nets)>=2: net_delta=max(0,nets[-1]-nets[0])
    return {'cpu':statistics.median(r['cpu'] for r in rows),'mem':statistics.median(r['mem'] for r in rows),'net':net_delta,'samples':len(rows)}

def resource_score(edge_path, tar_path):
    e,t=pi_stats(edge_path),pi_stats(tar_path)
    if not e or not t: return None,e,t
    parts=[]
    for key in ('cpu','mem','net'):
        r=ratio(t.get(key),e.get(key))
        if r is not None: parts.append(capped(r))
    return (100*statistics.mean(parts) if parts else None),e,t

def main(edge_path, tar_path, edge_pi=None, tar_pi=None):
    edge, tar = load(edge_path), load(tar_path)
    er, tr = index_runs(edge), index_runs(tar)
    missing=[];time_ratios=[];click_ratios=[];worst=10.0
    print('E7 task comparison (tar1090 = 100)')
    print(f"{'task':18s} {'edge_s':>8s} {'tar_s':>8s} {'ratio':>7s} {'edge_click':>10s} {'tar_click':>9s}")
    for task in TASKS:
        if task not in er or task not in tr:
            missing.append(task);continue
        ems,tms=med(er[task],'ms'),med(tr[task],'ms');ec,tc=med(er[task],'clicks'),med(tr[task],'clicks')
        r=ratio(tms,ems);cr=ratio(tc if tc and tc>0 else 1,ec if ec and ec>0 else 1)
        if r is not None: time_ratios.append(capped(r));worst=min(worst,r)
        if cr is not None: click_ratios.append(capped(cr))
        print(f"{task:18s} {ems/1000:8.2f} {tms/1000:8.2f} {r:7.2f} {ec:10.1f} {tc:9.1f}")
    if missing:
        print('MISSING:', ', '.join(missing), file=sys.stderr);return 2
    time_score=100*statistics.mean(time_ratios);click_score=100*statistics.mean(click_ratios) if click_ratios else 100.0
    boot_ratio=ratio(tar.get('firstAircraftMs'),edge.get('firstAircraftMs'));boot_score=100*capped(boot_ratio) if boot_ratio is not None else None
    res_score=e_res=t_res=None
    if edge_pi and tar_pi: res_score,e_res,t_res=resource_score(edge_pi,tar_pi)
    if res_score is not None and boot_score is not None: composite=.60*time_score+.15*click_score+.10*boot_score+.15*res_score
    elif res_score is not None: composite=.70*time_score+.15*click_score+.15*res_score
    elif boot_score is not None: composite=.70*time_score+.20*click_score+.10*boot_score
    else: composite=.80*time_score+.20*click_score
    print(f'\nTask-time score : {time_score:.1f}')
    print(f'Click score     : {click_score:.1f}')
    print(f'Boot score      : {boot_score:.1f}' if boot_score is not None else 'Boot score      : n/a')
    if res_score is not None:
        print(f'Resource score  : {res_score:.1f}')
        print(f"  Edge Pi       : CPU {e_res['cpu']:.1f}% · RAM {e_res['mem']:.1f}% · NET {e_res['net']/1e6:.2f} MB · {e_res['samples']} samples")
        print(f"  tar1090 Pi    : CPU {t_res['cpu']:.1f}% · RAM {t_res['mem']:.1f}% · NET {t_res['net']/1e6:.2f} MB · {t_res['samples']} samples")
    elif edge_pi or tar_pi: print('Resource score  : n/a (both valid Pi CSV files required)')
    else: print('Resource score  : n/a (optional --edge-pi/--tar-pi)')
    print(f'Worst task ratio: {worst:.2f}x')
    print(f'COMPOSITE       : {composite:.1f} (target >=130)')
    ok = composite >= 130 and worst >= (1/1.20)
    print('RESULT          :', 'PASS' if ok else 'FAIL')
    return 0 if ok else 1

if __name__=='__main__':
    p=argparse.ArgumentParser(description='E7 Edge vs tar1090 comparator')
    p.add_argument('edge_json',type=Path);p.add_argument('tar_json',type=Path)
    p.add_argument('--edge-pi',type=Path);p.add_argument('--tar-pi',type=Path)
    a=p.parse_args();sys.exit(main(a.edge_json,a.tar_json,a.edge_pi,a.tar_pi))
