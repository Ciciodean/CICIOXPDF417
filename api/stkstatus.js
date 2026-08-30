const crypto = require('crypto');

function getTimestamp() {
  const d = new Date();
  const eat = new Date(d.getTime() + (3 * 60 + d.getTimezoneOffset()) * 60000);
  const yyyy = eat.getFullYear();
  const mm = String(eat.getMonth() + 1).padStart(2, '0');
  const dd = String(eat.getDate()).padStart(2, '0');
  const hh = String(eat.getHours()).padStart(2, '0');
  const min = String(eat.getMinutes()).padStart(2, '0');
  const ss = String(eat.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${hh}${min}${ss}`;
}

function generateAccessToken(checkoutId, phone) {
  const secret = process.env.TOKEN_SECRET || 'cicioxpdf417_mpesa_secret_2026';
  const timestamp = Date.now();
  const payload = `${checkoutId}:${phone}:${timestamp}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, signature, timestamp })).toString('base64');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {}
    }
    body = body || {};

    const checkoutID = body.CheckoutRequestID;
    if (!checkoutID) {
      return res.status(400).json({ error: 'CheckoutRequestID is required' });
    }

    const intasendKey = process.env.INTASEND_PUBLISHABLE_KEY;
    const env = process.env.INTASEND_ENV || process.env.MPESA_ENV || 'sandbox';

    // Provider 1: IntaSend Invoice Status
    if (intasendKey) {
      const isLiveKey = intasendKey.startsWith('ISPubKey_live_') || env === 'live' || env === 'production';
      const intasendBase = isLiveKey ? 'https://payment.intasend.com' : 'https://sandbox.intasend.com';

      const intasendRes = await fetch(`${intasendBase}/api/v1/payment/status/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${intasendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ invoice_id: checkoutID })
      });

      const intasendData = await intasendRes.json().catch(() => null);

      if (intasendData && intasendData.invoice) {
        const state = (intasendData.invoice.state || '').toUpperCase();
        if (state === 'COMPLETE' || state === 'PROCESSING' || state === 'SUCCESS') {
          const receipt = intasendData.invoice.mpesa_reference || intasendData.invoice.invoice_id;
          const token = generateAccessToken(checkoutID, body.phone || '254700000000');
          return res.status(200).json({
            status: 'COMPLETED',
            message: 'Payment received via IntaSend',
            receipt: receipt,
            token: token
          });
        } else if (state === 'FAILED') {
          return res.status(200).json({ status: 'FAILED', message: 'Payment failed' });
        } else if (state === 'CANCELLED') {
          return res.status(200).json({ status: 'CANCELLED', message: 'Payment cancelled on phone' });
        } else {
          return res.status(200).json({ status: 'PENDING', message: 'Waiting for PIN entry' });
        }
      }
    }

    // Provider 2: Safaricom Daraja
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    const mockMode = process.env.MOCK_MODE === 'true' || !consumerKey || !consumerSecret || checkoutID.startsWith('ws_CO_MOCK_');

    if (mockMode) {
      if (body.forceState === 'CANCELLED') {
        return res.status(200).json({ status: 'CANCELLED', message: 'Request cancelled by user (MOCK)' });
      }
      if (body.forceState === 'COMPLETED') {
        const receipt = 'MOCK_MPESA_' + Date.now().toString(36).toUpperCase();
        const token = generateAccessToken(checkoutID, body.phone || '254700000000');
        return res.status(200).json({
          status: 'COMPLETED',
          message: 'The service request was processed successfully.',
          receipt: receipt,
          token: token,
          mockMode: true
        });
      }

      const timestampPart = checkoutID.split('_')[3];
      const startTime = timestampPart ? parseInt(timestampPart, 10) : Date.now() - 5000;
      const elapsed = Date.now() - startTime;

      if (elapsed < 3500) {
        return res.status(200).json({ status: 'PENDING', message: 'Waiting for PIN entry on handset... (MOCK)' });
      } else {
        const receipt = 'MOCK_MPESA_' + Date.now().toString(36).toUpperCase();
        const token = generateAccessToken(checkoutID, body.phone || '254700000000');
        return res.status(200).json({
          status: 'COMPLETED',
          message: 'The service request was processed successfully.',
          receipt: receipt,
          token: token,
          mockMode: true
        });
      }
    }

    const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const shortcode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919';

    const authHeader = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const authRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { 'Authorization': authHeader }
    });

    const authData = await authRes.json().catch(() => null);

    if (!authData || !authData.access_token) {
      return res.status(502).json({ error: 'Auth with Safaricom failed', details: authData });
    }

    const accessToken = authData.access_token;
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const queryPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutID
    };

    const queryRes = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(queryPayload)
    });

    const data = await queryRes.json().catch(() => ({}));

    if (data.ResultCode === '0') {
      const receipt = data.ResultDesc || 'Payment Received';
      const token = generateAccessToken(checkoutID, body.phone || '254700000000');
      return res.status(200).json({
        status: 'COMPLETED',
        message: 'The service request was processed successfully.',
        receipt: receipt,
        token: token
      });
    } else if (data.ResultCode === '1032') {
      return res.status(200).json({ status: 'CANCELLED', message: 'Request cancelled by user on mobile device.' });
    } else if (data.ResultCode === '1037') {
      return res.status(200).json({ status: 'TIMEOUT', message: 'Request timed out — PIN was not entered in time.' });
    } else {
      return res.status(200).json({ status: 'PENDING', message: data.ResultDesc || 'Transaction in progress' });
    }

  } catch (err) {
    console.error('STK Query Error:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};
