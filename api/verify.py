"""
/api/verify — PDF417 Scan Verification endpoint
------------------------------------------------
Receives a base64 PNG image of a rendered PDF417 barcode and decodes it
with zxing-cpp (the C++ ZXing library — the same decoder core used by
real-world scanners). Returns PASS/FAIL plus the decoded payload and
error-correction level, proving the barcode is genuinely scannable.

Vercel Python function entrypoint: class handler(BaseHTTPRequestHandler)
(per Vercel docs for file-based Python functions in /api)

Request  (POST, JSON):
  { "image": "<base64 PNG>", "expected": "<optional expected payload>" }

Response (200 JSON):
  { "ok": true, "match": bool, "decoded": "...", "length": n,
    "ecLevel": "...", "format": "PDF417" }
or
  { "ok": false, "error": "reason" }
"""
import base64
import io
import json

from http.server import BaseHTTPRequestHandler

import numpy as np
from PIL import Image
import zxingcpp


def decode_pdf417(png_bytes):
    """Decode a PNG payload with zxing-cpp. Returns dict or error dict."""
    try:
        img = Image.open(io.BytesIO(png_bytes)).convert('L')
        arr = np.array(img)
    except Exception:
        return {'error': 'Invalid image data — expected a PNG'}
    try:
        res = zxingcpp.read_barcode(
            arr,
            formats=zxingcpp.BarcodeFormat.PDF417,
        )
    except Exception as exc:  # pragma: no cover - defensive
        return {'error': 'Decoder error: %s' % exc}
    if not res:
        return {'error': 'No PDF417 barcode detected in image'}
    try:
        decoded = res.bytes.decode('latin1')
    except Exception:
        decoded = ''
    return {
        'decoded': decoded,
        'length': len(decoded),
        'ecLevel': getattr(res, 'ec_level', None),
        'format': str(res.format),
        'valid': bool(getattr(res, 'valid', True)),
    }


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
        body = json.dumps({'ok': True, 'endpoint': 'verify', 'decoder': 'zxing-cpp'})
        data = body.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    # -- POST (verify) -----------------------------------------------------
    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', 0) or 0)
            raw = self.rfile.read(length) if length > 0 else b''
            try:
                payload = json.loads(raw.decode('utf-8')) if raw else {}
            except Exception:
                payload = {}

            image_b64 = payload.get('image') or payload.get('png') or ''
            expected = payload.get('expected')

            if not image_b64:
                self._json(400, {'ok': False, 'error': 'Missing "image" (base64 PNG)'})
                return

            # Strip data URL prefix if present
            if image_b64.startswith('data:'):
                image_b64 = image_b64.split(',', 1)[-1]

            try:
                png_bytes = base64.b64decode(image_b64)
            except Exception:
                self._json(400, {'ok': False, 'error': 'Invalid base64 image'})
                return

            result = decode_pdf417(png_bytes)
            if 'error' in result:
                self._json(200, {'ok': False, 'error': result['error']})
                return

            match = (expected is None) or (result['decoded'] == expected)
            self._json(200, {
                'ok': True,
                'match': match,
                'decoded': result['decoded'],
                'length': result['length'],
                'ecLevel': result['ecLevel'],
                'format': result['format'],
                'valid': result.get('valid', True),
            })
        except Exception as exc:  # pragma: no cover - defensive
            try:
                self._json(400, {'ok': False, 'error': 'Verify failed: %s' % exc})
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
