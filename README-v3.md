# CICIOXPDF417 v3.1 — Smart PDF417 Generator

## What's new in v3.1 (Correct AAMVA IINs)

### 1. Fixed the Issuer Identification Numbers (IINs)
- The app previously shipped a **made-up sequential IIN list** (636001=Alabama,
  636002=Alaska, …) that did not match the real AAMVA table — barcodes produced
  with it had incorrect issuer headers.
- All 56 U.S. jurisdictions now use the **official AAMVA IINs** (per
  AAMVA's IIN & RID list):

| Jurisdiction | IIN | Jurisdiction | IIN |
|---|---|---|---|
| Alabama | 636033 | Nebraska | 636054 |
| Alaska | 636059 | Nevada | 636049 |
| Arizona | 636026 | New Hampshire | 636039 |
| Arkansas | 636021 | New Jersey | 636036 |
| California | 636014 | New Mexico | 636009 |
| Colorado | 636020 | New York | 636001 |
| Connecticut | 636006 | North Carolina | 636004 |
| Delaware | 636011 | North Dakota | 636034 |
| District of Columbia | 636043 | Ohio | 636023 |
| Florida | 636010 | Oklahoma | 636058 |
| Georgia | 636055 | Oregon | 636029 |
| Hawaii | 636047 | Pennsylvania | 636025 |
| Idaho | 636050 | Rhode Island | 636052 |
| Illinois | 636035 | South Carolina | 636005 |
| Indiana | 636037 | South Dakota | 636042 |
| Iowa | 636018 | Tennessee | 636053 |
| Kansas | 636022 | Texas | 636015 |
| Kentucky | 636046 | Utah | 636040 |
| Louisiana | 636007 | Vermont | 636024 |
| Maine | 636041 | Virginia | 636000 |
| Maryland | 636003 | Washington | 636045 |
| Massachusetts | 636002 | West Virginia | 636061 |
| Michigan | 636032 | Wisconsin | 636031 |
| Minnesota | 636038 | Wyoming | 636060 |
| Mississippi | 636051 | American Samoa | 604427 |
| Missouri | 636030 | Guam | 636019 |
| Montana | 636008 | N. Mariana Islands | 604430 |
| | | Puerto Rico | 604431 |
| | | U.S. Virgin Islands | 636062 |

- Added the 5 U.S. territories to both the **Issuer (IIN)** and **State (DAJ)**
  dropdowns (56 jurisdictions total), with form presets.
- IIN ↔ state bidirectional sync verified for all jurisdictions.

> **Important:** the IIN (in the barcode header after `ANSI`) is **not** the same
> as the jurisdiction abbreviation inside fields such as `DAJ`. The barcode
> contains both — this tool encodes each correctly.

---

## What's new in v3.0 (Intelligent Barcodes)

### 2. Real, scanner-verified barcodes
- **Fixed a critical bug**: the old `bwip-js toCanvas()` output looked like a PDF417
  but **could not be read by any real decoder** (zxing-cpp, ZBar, OpenCV, ZXing-JS
  all failed). Barcodes produced by the old app would not scan in the real world.
- Barcodes are now rendered with the **zxing-cpp encoder** (server-side, via
  `/api/barcode`) — the same C++ decoder core used by real-world scanners —
  or fall back to **bwip-js `toSVG`** (verified scannable) when the API is offline.
- Removed the redundant CDN `bwip-js@3.4.4` script that was **overwriting** the
  newer local v4.11.4 build and disabling SVG output.

### 3. Scan Test (independent verification)
- New **"📡 Run Scan Test"** button in the Verification tab.
- Sends the rendered barcode image to `/api/verify`, which decodes it with
  **zxing-cpp** — the same decoder core used by real scanners — and returns
  PASS/FAIL with the decoded payload, length, and EC level.
- Proves the barcode will scan in the real world, not just "look right".

### 4. Auto-repair
- If a Scan Test fails (e.g., a too-narrow 4-column layout), the tool
  automatically regenerates with higher error-correction / wider layout and
  prompts you to re-test.

### 5. Error-correction (EC) control
- New **Error Correction** selector (2/4/6/8) in Barcode Layout.
- EC 4 is the AAMVA-recommended default for DL barcodes.

### 6. Scannable exports
- **SVG export** now downloads the true SVG (vector, scannable).
- **PNG export** rasterizes from the SVG (scannable) — never from the broken
  canvas path.

---

## Deployment (Vercel)

The app uses **two Python serverless functions** alongside the existing Node ones.

### New files
| File | Purpose |
|---|---|
| `api/barcode.py` | Generates PDF417 as SVG using zxing-cpp encoder |
| `api/verify.py` | Decodes a PNG with zxing-cpp (independent scan verification) |
| `requirements.txt` | `zxing-cpp`, `Pillow`, `numpy` |

### `vercel.json`
Already updated with routes:
```json
{ "src": "/api/verify", "dest": "/api/verify.py" },
{ "src": "/api/barcode", "dest": "/api/barcode.py" }
```
and the `@vercel/python` build for `api/*.py`.

> **Note for Netlify**: the `netlify.toml` currently only publishes static files.
> To use Scan Test / server rendering on Netlify, add Python function support:
> ```toml
> [functions]
>   directory = "api"
> ```
> and deploy `api/barcode.py` + `api/verify.py` as Netlify Functions.

---

## M-Pesa integration (unchanged)
The M-Pesa STK push flow (`api/stkpush.js`, `api/stkstatus.js`, `api/callback.js`,
`api/config.js`) is untouched. See `SETUP-MPESA.md`.

---

## Testing locally

```bash
# Static files only (barcodes render via bwip-js SVG fallback):
python3 -m http.server 8080

# With the verification API:
pip install -r requirements.txt
python3 - <<'EOF'
# (see api/barcode.py / api/verify.py — they use the Vercel handler signature;
#  for local dev, wrap them with a tiny http server or use `vercel dev`)
EOF
```

Then open `http://localhost:8080` and click **Generate** → **Verification tab** →
**📡 Run Scan Test**.
