#!/usr/bin/env python3
import csv, json, tempfile
from pathlib import Path
import e7_compare

TASKS=e7_compare.TASKS

def write_json(path,suite,ms,clicks,boot):
    doc={'suite':suite,'firstAircraftMs':boot,'runs':[{'task':t,'ok':True,'ms':ms,'clicks':clicks} for t in TASKS]}
    path.write_text(json.dumps(doc),encoding='utf-8')

def write_pi(path,cpu,mem,net1,net2):
    with path.open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f);w.writerow(['unix_ts','cpu_percent','mem_usage','mem_percent','net_io','block_io','pids'])
        w.writerow([1,f'{cpu}%','100MiB / 1GiB',f'{mem}%',f'{net1}MB / 0MB','0B / 0B',10])
        w.writerow([2,f'{cpu}%','100MiB / 1GiB',f'{mem}%',f'{net2}MB / 0MB','0B / 0B',10])

with tempfile.TemporaryDirectory() as td:
    d=Path(td);edge=d/'edge.json';tar=d/'tar.json';ep=d/'edge.csv';tp=d/'tar.csv'
    # Edge is materially faster/lighter -> must pass.
    write_json(edge,'HPR Edge',600,1,500);write_json(tar,'tar1090',1000,2,900)
    write_pi(ep,20,10,10,20);write_pi(tp,35,18,10,30)
    assert e7_compare.main(edge,tar,ep,tp)==0
    # Edge slower on every core task -> must fail.
    write_json(edge,'HPR Edge',1300,3,1000)
    assert e7_compare.main(edge,tar,ep,tp)==1
print('E7 comparator smoke PASS')
