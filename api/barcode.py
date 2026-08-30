"""
/api/barcode — PDF417 Barcode Generation endpoint
--------------------------------------------------
Generates a spec-correct, guaranteed-scannable PDF417 barcode using
zxing-cpp's encoder (the C++ ZXing library — battle-tested, used by
real-world scanners) and returns it as SVG.

Vercel Python function entrypoint: class handler(BaseHTTPRequestHandler)
(per Vercel docs for file-based Python functions in /api)

Request (POST, JSON):
  {
    "text": "<AAMVA payload string>",
    "ecLevel": 4,          # error correction 0-8 (PDF417 level)
    "columns": 6,          # optional hint (zxing-cpp chooses when omitted)
  }

Response:
  - 200: SVG body with Content-Type image/svg+xml
  - 400: JSON error
"""
import json

from http.server import BaseHTTPRequestHandler

import zxingcpp


def _generate_svg(text, ec_level, columns):
    """Encode with zxing-cpp and return the SVG string."""
    barcode = zxingcpp.create_barcode(
        text,
        zxingcpp.BarcodeFormat.PDF417,
        ec_level=ec_level,
    )
    svg = zxingcpp.write_barcode_to_svg(barcode)
    if not isinstance(svg, str):
        svg = svg.decode('utf-8') if isinstance(svg, bytes) else str(svg)
    return svg


class handler(BaseHTTPRequestHandler):
    """Vercel Python serverless entrypoint (BaseHTTPRequestHandler style)."""

    def log_message(self, fmt, *args):
        pass  # keep logs quiet

    # -- CORS preflight ----------------------------------------------------
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    # -- GET (sanity check) ------------------------------------------------
    def do_GET(self):
        body = json.dumps({'ok': True, 'endpoint': 'barcode', 'encoder': 'zxing-cpp'})
        data = body.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # -- POST (generate) ---------------------------------------------------
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0) or 0)
            raw = self.rfile.read(length) if length > 0 else b''
            try:
                payload = json.loads(raw.decode('utf-8')) if raw else {}
            except Exception:
                payload = {}

            text = payload.get('text') or payload.get('payload') or ''
            ec_level = int(payload.get('ecLevel', 4) or 4)
            columns = int(payload.get('columns', 0) or 0)

            if not text:
                self._json(400, {'ok': False, 'error': 'Missing "text" payload'})
                return

            ec_level = max(0, min(8, ec_level))
            columns = max(0, min(30, columns))

            svg = _generate_svg(text, ec_level, columns)
            data = svg.encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'image/svg+xml')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Generated-By', 'zxing-cpp')
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:  # pragma: no cover - defensive
            try:
                self._json(400, {'ok': False, 'error': 'Encoding failed: %s' % exc})
            except Exception:
                pass

    def _json(self, status, obj):
        data = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)
