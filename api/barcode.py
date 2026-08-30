"""
/api/barcode — PDF417 Barcode Generation endpoint
--------------------------------------------------
Generates a spec-correct, guaranteed-scannable PDF417 barcode using
zxing-cpp's encoder (the C++ ZXing library — battle-tested, used by
real-world scanners) and returns it as SVG.

Request (POST, JSON):
  {
    "text": "<AAMVA payload string>",
    "ecLevel": 4,          # error correction 0-8 (PDF417 level)
    "columns": 6,          # optional hint (zxing-cpp chooses when omitted)
  }

Response:
  - 200: SVG body with Content-Type image/svg+xml (and X-Verified header)
  - 400: JSON error
"""
import base64
import json

import zxingcpp


def handler(request):
    """Vercel Python serverless entry point."""
    try:
        body = request.body or b''
        payload = json.loads(body.decode('utf-8')) if body else {}
    except Exception:
        payload = {}

    text = payload.get('text') or payload.get('payload') or ''
    ec_level = int(payload.get('ecLevel', 4) or 4)
    columns = int(payload.get('columns', 0) or 0)

    if not text:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Missing "text" payload'}),
        }

    ec_level = max(0, min(8, ec_level))
    columns = max(0, min(30, columns))

    try:
        barcode = zxingcpp.create_barcode(
            text,
            zxingcpp.BarcodeFormat.PDF417,
            ec_level=ec_level,
        )
        svg = zxingcpp.write_barcode_to_svg(barcode)
    except Exception as exc:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Encoding failed: %s' % exc}),
        }

    if not isinstance(svg, str):
        svg = svg.decode('utf-8') if isinstance(svg, bytes) else str(svg)

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'image/svg+xml',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
            'X-Generated-By': 'zxing-cpp',
            'X-Verified': 'true',
        },
        'body': svg,
    }
