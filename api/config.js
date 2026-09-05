module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawPrice = process.env.MPESA_PRICE_KES ? String(process.env.MPESA_PRICE_KES).trim() : '50';
  const price = parseInt(rawPrice, 10) || 50;
  const mockMode = process.env.MOCK_MODE === 'true';

  res.status(200).json({
    price: price,
    currency: 'KES',
    mockMode: mockMode,
    shortcode: process.env.MPESA_SHORTCODE || '174379',
    environment: process.env.MPESA_ENV || 'live'
  });
};
