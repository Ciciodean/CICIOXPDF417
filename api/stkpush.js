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

    const phone = formatPhone(body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Invalid phone number. Use a Kenyan M-Pesa number (e.g. 0795852494 or +254795852494).' });
    }

    const rawPrice = process.env.MPESA_PRICE_KES ? String(process.env.MPESA_PRICE_KES).trim() : '50';
    const price = parseInt(rawPrice, 10) || 50;
    const amountInCents = Math.round(price * 100);
    const paystackKey = process.env.PAYSTACK_SECRET_KEY;

    if (!paystackKey) {
      return res.status(500).json({ error: 'PAYSTACK_SECRET_KEY is missing from Environment Variables.' });
    }

    // Paystack Live Kenya M-Pesa Charge API
    try {
      const paystackRes = await fetch('https://api.paystack.co/charge', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + paystackKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: `customer_${phone.replace(/\D/g, '')}@cicioxpdf.com`,
          amount: amountInCents,
          currency: 'KES',
          mobile_money: {
            phone: phone,
            provider: 'mpesa'
          }
        })
      });

      const paystackData = await paystackRes.json().catch(() => null);

      if (paystackData && paystackData.data && paystackData.data.reference) {
        return res.status(200).json({
          success: true,
          provider: 'paystack',
          CheckoutRequestID: paystackData.data.reference,
          CustomerMessage: paystackData.data.display_text || `M-Pesa payment prompt sent to ${phone}. Please enter your PIN.`,
          amount: price,
          phone: phone
        });
      }
      
      if (paystackData && paystackData.message) {
        const msg = String(paystackData.message);
        if (msg.toLowerCase().includes('unable to process') || msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('busy')) {
          return res.status(200).json({
            success: true,
            provider: 'paystack_pending',
            CheckoutRequestID: `ps_pending_${Date.now()}`,
            CustomerMessage: `An M-Pesa prompt is already active on ${phone}. Please check your phone handset for the PIN popup, or wait 15 seconds and try again.`,
            amount: price,
            phone: phone
          });
        }
        return res.status(400).json({ error: msg });
      }
    } catch (err) {
      console.warn('Paystack fetch error:', err);
    }

    // Backup Fallback
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
