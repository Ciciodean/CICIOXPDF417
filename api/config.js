module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.status(200).json({
    price: 10,
    currency: 'KES',
    mockMode: false,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || 'pk_live_301f2f8a4f913d94ca1341a996b27e85c181bc7e',
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    environment: process.env.MPESA_ENV || 'live'
  });
};
