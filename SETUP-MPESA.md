# CICIOXPDF417 — M-Pesa Setup & Vercel Deployment Guide

This guide walks you through setting up **M-Pesa STK Push payments** for your CICIOXPDF417 application on Vercel.

---

## 1. How It Works
- When users generate a barcode, a **watermarked preview** is shown.
- Downloads (PNG/SVG) and raw data exports are locked until the user pays via **M-Pesa STK Push**.
- The app sends a payment prompt directly to the user's mobile phone (e.g. `0712345678`).
- Upon entering their M-Pesa PIN, payment is automatically verified via Safaricom Daraja API query and access is unlocked instantly.

---

## 2. Deploying to Vercel

### Files Structure for Vercel
Your repository structure on Vercel:
```
cicioxpdf/
├── index.html        # Main app UI & paywall logic
├── js/
│   ├── aamva.js      # AAMVA encoder & decoder module
│   └── bwip.min.js   # Barcode rendering library
├── api/              # Vercel Serverless Functions
│   ├── config.js     # Returns price & payment configuration
│   ├── stkpush.js    # Triggers M-Pesa STK push prompt
│   ├── stkstatus.js  # Polls transaction status
│   └── callback.js  # Safaricom callback logger
├── .env.example      # Environment variables template
└── vercel.json       # Optional Vercel routing configuration
```

---

## 3. Configuring M-Pesa Credentials in Vercel

1. Log in to your **Vercel Dashboard** and select your project (`cicioxpdf-417`).
2. Go to **Settings** → **Environment Variables**.
3. Add the following variables:

| Variable Name | Example Value | Description |
|---|---|---|
| `MPESA_CONSUMER_KEY` | `u1x...` | Your Consumer Key from Safaricom Developer Portal |
| `MPESA_CONSUMER_SECRET` | `Abc...` | Your Consumer Secret from Safaricom Developer Portal |
| `MPESA_SHORTCODE` | `174379` | Paybill or Till Number (Sandbox default: `174379`) |
| `MPESA_PASSKEY` | `bfb279f...` | Lipa Na M-Pesa Passkey |
| `MPESA_ENV` | `sandbox` or `production` | Set to `production` when going live |
| `MPESA_PRICE_KES` | `100` | Price per access in KES |
| `MOCK_MODE` | `false` | Set to `true` to test payments without real Daraja keys |

4. Click **Save** and trigger a **Redeploy** on Vercel.

---

## 4. How to Get Safaricom Daraja API Keys

### Sandbox / Testing
1. Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/).
2. Create a new App under **My Apps**.
3. Select **Lipa Na M-Pesa Online (STK Push)**.
4. Copy the **Consumer Key** and **Consumer Secret**.
5. Use default Sandbox shortcode `174379` and passkey `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`.

### Production / Live
1. Apply for Go-Live on Safaricom Developer Portal with your Business Paybill / Till Number details.
2. Update `MPESA_ENV` to `production` and enter your live Consumer Key, Consumer Secret, Shortcode, and Passkey in Vercel.

---

## 5. Local Development & Testing
To test the complete payment flow locally in live preview:
```bash
node server.js
```
Open `http://localhost:8000`. By default, if no Daraja keys are set, the app runs in **Mock Mode** so you can simulate STK Push prompts and unlock access immediately without spending real money.
