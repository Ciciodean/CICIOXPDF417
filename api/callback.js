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

    console.log('M-Pesa Callback Received:', JSON.stringify(body, null, 2));

    res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully'
    });
  } catch (err) {
    console.error('M-Pesa Callback Error:', err);
    res.status(200).json({
      ResultCode: 1,
      ResultDesc: 'Failed to process callback: ' + err.message
    });
  }
};
