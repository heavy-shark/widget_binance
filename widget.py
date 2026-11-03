#!/usr/bin/env python3
"""Binance Futures positions widget.

Every 3 seconds polls /fapi/v3/positionRisk (one signed request, weight 5),
keeps the result in memory and serves a small HTML page on localhost.
Stdlib only, no dependencies.

Keys: BINANCE_API_KEY / BINANCE_API_SECRET from the environment or from .env
next to this file. A read-only key (no trading, no withdrawals) is enough.
"""
import hashlib
import hmac
import json
import os
import ssl
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE = "https://fapi.binance.com"
POLL_SEC = 3
PORT = int(os.environ.get("WIDGET_PORT", "8765"))
HERE = Path(__file__).resolve().parent
# python.org builds on macOS ship without CA certs; use the system bundle if present
SSL_CTX = ssl.create_default_context(
    cafile="/etc/ssl/cert.pem" if os.path.exists("/etc/ssl/cert.pem") else None)


def load_env():
    env_file = HERE / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
API_KEY = os.environ.get("BINANCE_API_KEY", "")
API_SECRET = os.environ.get("BINANCE_API_SECRET", "")

state = {"positions": [], "error": None, "updated": 0}
lock = threading.Lock()
time_offset = 0  # binance server time - local time, ms


def http_get(path, params=None, signed=False):
    params = dict(params or {})
    headers = {}
    if signed:
        params["timestamp"] = int(time.time() * 1000) + time_offset
        params["recvWindow"] = 10000
        query = urllib.parse.urlencode(params)
        sig = hmac.new(API_SECRET.encode(), query.encode(), hashlib.sha256).hexdigest()
        query += "&signature=" + sig
        headers["X-MBX-APIKEY"] = API_KEY
    else:
        query = urllib.parse.urlencode(params)
    url = f"{BASE}{path}" + (f"?{query}" if query else "")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from None


def sync_time():
    global time_offset
    server = http_get("/fapi/v1/time")["serverTime"]
    time_offset = server - int(time.time() * 1000)


def fetch_positions():
    rows = http_get("/fapi/v3/positionRisk", signed=True)
    out = []
    for p in rows:
        amt = float(p["positionAmt"])
        if amt == 0:
            continue
        entry = float(p["entryPrice"])
        mark = float(p["markPrice"])
        upnl = float(p["unRealizedProfit"])
        margin = float(p.get("positionInitialMargin") or 0) or float(p.get("initialMargin") or 0)
        side = p.get("positionSide", "BOTH")
        if side == "BOTH":
            side = "LONG" if amt > 0 else "SHORT"
        out.append({
            "symbol": p["symbol"],
            "side": side,
            "size": abs(amt),
            "entry": entry,
            "mark": mark,
            "liq": float(p.get("liquidationPrice") or 0),
            "notional": abs(float(p.get("notional") or 0)),
            "upnl": upnl,
            "roe": (upnl / margin * 100) if margin else None,
            "change": ((mark - entry) / entry * 100 * (1 if amt > 0 else -1)) if entry else None,
            "marginAsset": p.get("marginAsset", "USDT"),
        })
    out.sort(key=lambda x: -x["notional"])
    return out


def poller():
    last_sync = 0
    while True:
        try:
            if time.time() - last_sync > 600:
                sync_time()
                last_sync = time.time()
            positions = fetch_positions()
            with lock:
                state.update(positions=positions, error=None, updated=int(time.time() * 1000))
        except Exception as e:  # keep running, show error in the widget
            if "-1021" in str(e):  # timestamp outside recvWindow
                last_sync = 0
            with lock:
                state["error"] = str(e)
        time.sleep(POLL_SEC)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api"):
            with lock:
                body = json.dumps(state).encode()
            ctype = "application/json"
        elif self.path in ("/", "/index.html"):
            body = (HERE / "index.html").read_bytes()
            ctype = "text/html; charset=utf-8"
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def main():
    if not API_KEY or not API_SECRET:
        state["error"] = "Нет ключей: заполни BINANCE_API_KEY / BINANCE_API_SECRET в .env"
    else:
        threading.Thread(target=poller, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Widget: http://127.0.0.1:{PORT}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
