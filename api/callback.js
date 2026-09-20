const fs = require('fs');
const path = require('path');

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

function parseMpesaSms(text) {
  if (!text) return null;
  const str = String(text).trim();

  // Extract 10-char transaction code
  const codeMatch = str.match(/\b([A-Z0-9]{10})\b/);
  // Extract amount (Ksh 50, Ksh50.00, KSH 100, etc.)
  const amtMatch = str.match(/Ksh\s*([\d,]+(?:\.\d{2})?)/i) || str.match(/KSH\s*([\d,]+)/i);

  if (codeMatch) {
    const code = codeMatch[1].toUpperCase();
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, '')) : 50;
    return { code, amount, raw: str };
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    // Get SMS text from various SMS forwarder payload fields (text, message, sms, body, content)
    const smsText = body.text || body.message || body.sms || body.content || body.body || (typeof body === 'string' ? body : '');
    
    console.log('Incoming Callback Body:', JSON.stringify(body));

    const parsed = parseMpesaSms(smsText);

    if (parsed) {
      const store = loadCodes();
      store[parsed.code] = {
        amount: parsed.amount,
        used: false,
        addedAt: Date.now(),
        source: 'sms_forwarder',
        rawSms: parsed.raw
      };
      saveCodes(store);

      console.log(`✅ 24/7 SMS AUTO-APPROVED: M-Pesa Code ${parsed.code} (KES ${parsed.amount}) added to database!`);

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: `Success! Code ${parsed.code} auto-approved for KES ${parsed.amount}`,
        code: parsed.code,
        amount: parsed.amount
      });
    }

    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully (No M-Pesa code found in text)'
    });
  } catch (err) {
    console.error('M-Pesa Callback Error:', err);
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: 'Failed to process callback: ' + err.message
    });
  }
};
