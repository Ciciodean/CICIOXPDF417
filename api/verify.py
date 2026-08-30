"""
/api/verify — PDF417 Scan Verification endpoint
------------------------------------------------
Receives a base64 PNG image of a rendered PDF417 barcode and decodes it
with zxing-cpp (the C++ ZXing library — the same decoder core used by
real-world scanners). Returns PASS/FAIL plus the decoded payload and
error-correction level, proving the barcode is genuinely scannable.

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

import numpy as np
from PIL import Image
import zxingcpp


def decode_pdf417(png_bytes):
    """Decode a PNG payload with zxing-cpp. Returns dict or None."""
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


def handler(request):
    """Vercel Python serverless entry point."""
    try:
        body = request.body or b''
        payload = json.loads(body.decode('utf-8')) if body else {}
    except Exception:
        payload = {}

    image_b64 = payload.get('image') or payload.get('png') or ''
    expected = payload.get('expected')

    if not image_b64:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Missing "image" (base64 PNG)'}),
        }

    # Strip data URL prefix if present
    if image_b64.startswith('data:'):
        image_b64 = image_b64.split(',', 1)[-1]

    try:
        png_bytes = base64.b64decode(image_b64)
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Invalid base64 image'}),
        }

    result = decode_pdf417(png_bytes)
    if 'error' in result:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': result['error']}),
        }

    match = (expected is None) or (result['decoded'] == expected)
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'ok': True,
            'match': match,
            'decoded': result['decoded'],
            'length': result['length'],
            'ecLevel': result['ecLevel'],
            'format': result['format'],
            'valid': result.get('valid', True),
        }),
    }
