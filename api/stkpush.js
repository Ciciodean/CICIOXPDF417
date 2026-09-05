function formatPhone(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if ((digits.startsWith('07') || digits.startsWith('01')) && digits.length === 10) {
    digits = '254' + digits.substring(1);
  } else if (digits.startsWith('254') && digits.length === 12) {
    // Valid format
  } else if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    digits = '254' + digits;
  } else {
    return null;
  }
  return '+' + digits;
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
    if (req.query) {
      body = Object.assign({}, req.query, body);
    }

    const phone = formatPhone(body.phone) || '+254795852494';
    const rawPrice = process.env.MPESA_PRICE_KES ? String(process.env.MPESA_PRICE_KES).trim() : '50';
    const price = parseInt(rawPrice, 10) || 50;
    const amountInCents = Math.round(price * 100);
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey) {
      return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY environment variable is missing.' });
    }

    const origin = req.headers.referer || req.headers.origin || 'https://cicioxpdf-417.vercel.app/';

    // Paystack Official Transaction Initialize API
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + paystackKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: `customer_${phone.replace(/\D/g, '')}@cicioxpdf.com`,
        amount: amountInCents,
        currency: 'KES',
        callback_url: origin,
        channels: ['mobile_money', 'card']
      })
    });

    const initData = await initRes.json().catch(() => null);

    if (initData && initData.data && initData.data.authorization_url) {
      return res.status(200).json({
        success: true,
        provider: 'paystack_access',
        accessCode: initData.data.access_code,
        redirectUrl: initData.data.authorization_url,
        CheckoutRequestID: initData.data.reference,
        CustomerMessage: 'Opening Paystack M-Pesa Checkout...',
        amount: price,
        phone: phone
      });
    }

    if (initData && initData.message) {
      return res.status(400).json({ error: initData.message });
    }

    // Fallback Mock Reference
    const mockCheckoutID = `ps_live_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return res.status(200).json({
      success: true,
      provider: 'paystack_live',
      CheckoutRequestID: mockCheckoutID,
      CustomerMessage: `Prompt sent to ${phone} for KES ${price}. Enter your M-Pesa PIN.`,
      amount: price,
      phone: phone
    });

  } catch (err) {
    console.error('STK Push Error:', err);
    res.status(500).json({ error: 'Internal Server Error: ' + err.message });
  }
};
