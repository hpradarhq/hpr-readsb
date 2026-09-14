#!/usr/bin/env python3
import argparse
import base64
import os
import socket
import struct
import subprocess
import tempfile
import time

AIRCRAFT = 400
SBS_PORT = 39003
WS_PORT = 30154


def wait_port(port, timeout=8.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=0.2)
            s.close()
            return
        except OSError:
            time.sleep(0.05)
    raise RuntimeError(f"port {port} did not open")


def sbs_line(i, pos_bump=0.0, ident_bump=0):
    icao = 0xA00000 + i
    lat = 10.0 + (i % 20) * 0.20 + pos_bump
    lon = 100.0 + (i % 25) * 0.20 + pos_bump
    alt = 5000 + (i % 100) * 250
    gs = 180 + (i % 300)
    track = (i * 7) % 360
    vr = ((i % 9) - 4) * 128
    prefix = chr(ord("A") + (ident_bump % 26))
    callsign = f"{prefix}{i:06d}"[-8:]
    return (
        f"MSG,3,1,1,{icao:06X},1,2026/09/13,10:00:00.000,2026/09/13,10:00:00.000,"
        f"{callsign},{alt},{gs},{track},{lat:.6f},{lon:.6f},{vr},1200,0,0,0,0\r\n"
    ).encode()


def feed_all(pos_bump=0.0, ident_bump=0, repeats=2):
    with socket.create_connection(("127.0.0.1", SBS_PORT), timeout=2) as s:
        for _ in range(repeats):
            for i in range(AIRCRAFT):
                s.sendall(sbs_line(i, pos_bump, ident_bump))


def recv_exact(s, n):
    out = bytearray()
    while len(out) < n:
        chunk = s.recv(n - len(out))
        if not chunk:
            raise RuntimeError("websocket closed")
        out.extend(chunk)
    return bytes(out)


def ws_connect():
    s = socket.create_connection(("127.0.0.1", WS_PORT), timeout=3)
    key = base64.b64encode(os.urandom(16)).decode()
    req = (
        "GET /ws/air HTTP/1.1\r\n"
        "Host: 127.0.0.1\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode()
    s.sendall(req)
    data = bytearray()
    while b"\r\n\r\n" not in data:
        data.extend(s.recv(1024))
    if b" 101 " not in data.split(b"\r\n", 1)[0]:
        raise RuntimeError(f"bad websocket handshake: {data[:120]!r}")
    s.settimeout(3)
    return s


def ws_recv(s):
    h = recv_exact(s, 2)
    opcode = h[0] & 0x0F
    n = h[1] & 0x7F
    if h[1] & 0x80:
        raise RuntimeError("server frame must not be masked")
    if n == 126:
        n = struct.unpack("!H", recv_exact(s, 2))[0]
    elif n == 127:
        n = struct.unpack("!Q", recv_exact(s, 8))[0]
    return opcode, recv_exact(s, n)


def ws_text(s, text):
    payload = text.encode()
    mask = os.urandom(4)
    if len(payload) >= 126:
        raise ValueError("test control frame too large")
    frame = bytearray([0x81, 0x80 | len(payload)]) + bytearray(mask)
    frame.extend(b ^ mask[i & 3] for i, b in enumerate(payload))
    s.sendall(frame)


def parse_airwire(payload):
    i = 0
    pos = set()
    ident = set()
    meta = set()
    while i < len(payload):
        t = payload[i]
        if t == 0x02:
            if i + 20 > len(payload):
                raise RuntimeError("truncated 0x02")
            icao = payload[i+1] | payload[i+2] << 8 | payload[i+3] << 16
            pos.add(icao)
            i += 20
        elif t == 0x06:
            if i + 15 > len(payload):
                raise RuntimeError("truncated 0x06")
            icao = payload[i+1] | payload[i+2] << 8 | payload[i+3] << 16
            ident.add(icao)
            i += 15
        elif t == 0x0A:
            if i + 20 > len(payload):
                raise RuntimeError("truncated 0x0a")
            icao = payload[i+1] | payload[i+2] << 8 | payload[i+3] << 16
            meta.add(icao)
            i += 20
        else:
            raise RuntimeError(f"unknown frame type 0x{t:02x} at {i}")
    return pos, ident, meta


def snapshot(s, min_pos):
    deadline = time.time() + 6
    best_pos = set()
    best_ident = set()
    best_meta = set()
    while time.time() < deadline:
        opcode, payload = ws_recv(s)
        if opcode != 2:
            continue
        pos, ident, meta = parse_airwire(payload)
        if len(pos) > len(best_pos):
            best_pos, best_ident, best_meta = pos, ident, meta
        if len(pos) >= min_pos:
            return pos, ident, meta
    raise RuntimeError(f"snapshot only had {len(best_pos)} positions / {len(best_ident)} identities / {len(best_meta)} metadata")


def rss_kib(pid):
    with open(f"/proc/{pid}/status", encoding="utf-8") as f:
        for line in f:
            if line.startswith("VmRSS:"):
                return int(line.split()[1])
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--readsb", default="./readsb")
    args = ap.parse_args()
    with tempfile.TemporaryDirectory(prefix="hpr-airwire-") as outdir:
        proc = subprocess.Popen([
            args.readsb, "--net", "--net-only", "--quiet", "--json-reliable=0",
            f"--net-sbs-in-port={SBS_PORT}",
            f"--write-json={outdir}", "--write-json-every=1",
        ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        try:
            wait_port(SBS_PORT)
            wait_port(WS_PORT)
            feed_all(repeats=3)
            time.sleep(1.0)

            c = ws_connect()
            pos, ident, meta = snapshot(c, 390)
            if len(ident) < 390:
                raise RuntimeError(f"identity snapshot too small: {len(ident)}")
            if len(meta) < 390:
                raise RuntimeError(f"metadata snapshot too small: {len(meta)}")
            print(f"snapshot: {len(pos)} position, {len(ident)} identity, {len(meta)} metadata")

            ws_text(c, "box:10.0,10.7,100.0,100.7,8")
            opcode, payload = ws_recv(c)
            if opcode != 2:
                raise RuntimeError("bbox response not binary")
            bpos, _, _ = parse_airwire(payload)
            if not (0 < len(bpos) < len(pos)):
                raise RuntimeError(f"bbox filtering ineffective: {len(bpos)} of {len(pos)}")
            print(f"bbox: {len(bpos)} position")

            feed_all(pos_bump=0.0001, repeats=2)
            dpos = set()
            deadline = time.time() + 4
            while time.time() < deadline and len(dpos) < 5:
                op, p = ws_recv(c)
                if op == 2:
                    pp, _, _ = parse_airwire(p)
                    dpos |= pp
            if not dpos:
                raise RuntimeError("no live position/motion delta received")
            print(f"delta: {len(dpos)} position/motion in active bbox")
            c.close()

            c2 = ws_connect()
            snapshot(c2, 390)
            c2.close()
            print("reconnect: PASS")

            clients = [ws_connect() for _ in range(4)]
            for x in clients:
                snapshot(x, 390)
            print("4 clients: PASS")

            slow = ws_connect()
            rss0 = rss_kib(proc.pid)
            for wave in range(1, 13):
                feed_all(pos_bump=0.0001, ident_bump=wave, repeats=1)
                time.sleep(0.05)
            time.sleep(0.5)
            rss1 = rss_kib(proc.pid)
            if rss1 - rss0 > 65536:
                raise RuntimeError(f"RSS grew too much: {rss0} -> {rss1} KiB")
            print(f"slow-client/RSS: PASS ({rss0} -> {rss1} KiB)")
            slow.close()
            for x in clients:
                x.close()

            print("hpr_airwire_ws_synthetic: PASS")
        finally:
            proc.terminate()
            try:
                _, err = proc.communicate(timeout=4)
            except subprocess.TimeoutExpired:
                proc.kill(); _, err = proc.communicate()
            if proc.returncode not in (0, -15) and err:
                print(err[-4000:])


if __name__ == "__main__":
    main()
