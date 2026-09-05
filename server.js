const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Load .env file if present
if (fs.existsSync(path.join(__dirname, '.env'))) {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      process.env[key] = val;
    }
  });
}

// API handlers
const configHandler = require('./api/config');
const stkpushHandler = require('./api/stkpush');
const stkstatusHandler = require('./api/stkstatus');
const callbackHandler = require('./api/callback');
const verifyCodeHandler = require('./api/verify-code');

const PORT = process.env.PORT || 8000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve(body);
      }
    });
  });
}

function adaptRes(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  adaptRes(res);

  // Route API requests (support both /api/stkpush and /api/stkpush.js)
  if (pathname.startsWith('/api/')) {
    req.body = await parseBody(req);
    req.query = parsedUrl.query;

    if (pathname === '/api/config' || pathname === '/api/config.js') return configHandler(req, res);
    if (pathname === '/api/stkpush' || pathname === '/api/stkpush.js') return stkpushHandler(req, res);
    if (pathname === '/api/stkstatus' || pathname === '/api/stkstatus.js') return stkstatusHandler(req, res);
    if (pathname === '/api/callback' || pathname === '/api/callback.js') return callbackHandler(req, res);
    if (pathname === '/api/verify-code' || pathname === '/api/verify-code.js') return verifyCodeHandler(req, res);

    return res.status(404).json({ error: 'API Endpoint Not Found' });
  }

  // Serve static files
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);
  
  if (!filePath.startsWith(ROOT_DIR)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      return res.end('404 Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CICIOXPDF417 server with M-Pesa API listening on http://0.0.0.0:${PORT}`);
});
