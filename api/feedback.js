const SCRIPT_URL = process.env.FEEDBACK_SCRIPT_URL;
const CSRF_SECRET = process.env.CSRF_SECRET || 'gambit-csrf-default';

// Simple in-memory rate limiting (resets on cold start, but good enough for serverless)
const rateLimit = new Map();
const RATE_WINDOW = 60000; // 1 minute
const RATE_MAX = 5; // max 5 per minute per IP

function checkRate(ip) {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateLimit.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count++;
  return true;
}

function generateToken() {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 10);
  return timestamp + '.' + rand;
}

function validateToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const timestamp = parseInt(parts[0], 36);
  const age = Date.now() - timestamp;
  // Token valid for 1 hour
  return age > 0 && age < 3600000;
}

export default async function handler(req, res) {
  // CORS - only allow our own origin
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://gambitco.io', 'https://www.gambitco.io'];
  if (process.env.VERCEL_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000');
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET = return a CSRF token
  if (req.method === 'GET') {
    const token = generateToken();
    return res.status(200).json({ token });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate CSRF token
  const csrfToken = req.headers['x-csrf-token'];
  if (!validateToken(csrfToken)) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  // Validate body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!body.feedback || typeof body.feedback !== 'string' || body.feedback.length > 2000) {
    return res.status(400).json({ error: 'Invalid feedback' });
  }

  if (!body.rating || typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
    return res.status(400).json({ error: 'Invalid rating' });
  }

  if (!SCRIPT_URL) {
    console.error('FEEDBACK_SCRIPT_URL not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Forward to Google Apps Script
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        rating: body.rating,
        feedback: body.feedback,
        timestamp: new Date().toISOString()
      })
    });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Script proxy error:', err);
    return res.status(500).json({ error: 'Submission failed' });
  }
}
