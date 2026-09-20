const fs = require('fs');
const path = require('path');

// Simple in-memory / file-backed verified codes store
const CODES_FILE = path.join('/tmp', 'ciciox_verified_codes.json');

function loadCodes() {
  try {
    if (fs.existsSync(CODES_FILE)) {
      return JSON.parse(fs.readFileSync(CODES_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveCodes(data) {
  try {
    fs.writeFileSync(CODES_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const action = body.action || (req.method === 'GET' ? 'list' : 'verify');

    // Action 1: Add new verified code (Admin action)
    if (action === 'add' || body.adminKey === '0795852494') {
      const code = (body.code || '').trim().toUpperCase();
      if (!code || !/^[A-Z0-9]{10}$/.test(code)) {
        return res.status(400).json({ error: 'Code must be 10 alphanumeric characters.' });
      }
      const store = loadCodes();
      store[code] = {
        amount: body.amount || 50,
        used: false,
        addedAt: Date.now()
      };
      saveCodes(store);
      return res.status(200).json({ success: true, message: `Code ${code} added to verified database.`, code });
    }

    // Action 2: Verify code (Customer action)
    const code = (body.code || '').trim().toUpperCase();
    if (!code || !/^[A-Z0-9]{10}$/.test(code)) {
      return res.status(400).json({ error: '❌ Invalid M-Pesa format. Enter a 10-character code from your SMS.' });
    }

    const store = loadCodes();
    const entry = store[code];

    // If code exists in verified database
    if (entry) {
      if (entry.used) {
        return res.status(400).json({ error: `⚠️ M-Pesa code ${code} has already been used to unlock barcodes.` });
      }

      // Mark code as used
      entry.used = true;
      entry.usedAt = Date.now();
      saveCodes(store);

      return res.status(200).json({
        success: true,
        message: '✅ M-Pesa Code Verified! 3 Barcode Credits granted.',
        credits: 3,
        code
      });
    }

    // Check if code was logged in STK/C2B callbacks
    const callbackFile = path.join('/tmp', 'ciciox_callbacks.json');
    try {
      if (fs.existsSync(callbackFile)) {
        const callbacks = JSON.parse(fs.readFileSync(callbackFile, 'utf8'));
        if (callbacks[code] && !callbacks[code].used) {
          callbacks[code].used = true;
          fs.writeFileSync(callbackFile, JSON.stringify(callbacks, null, 2), 'utf8');
          return res.status(200).json({
            success: true,
            message: '✅ M-Pesa Payment Verified! 3 Barcode Credits granted.',
            credits: 3,
            code
          });
        }
      }
    } catch (e) {}

    // Reject unverified / guessed codes
    return res.status(400).json({
      error: `❌ Unverified M-Pesa Code (${code}). Payment has not been received on 0795852494 for this code yet. Please check your SMS and try again.`
    });

  } catch (err) {
    console.error('Verify Code Error:', err);
    res.status(500).json({ error: 'Server error verifying code: ' + err.message });
  }
};
