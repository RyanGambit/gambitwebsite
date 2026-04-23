import { PROPOSAL_CONTEXT } from '../lib/dejero-context.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

// Simple in-memory rate limiting (resets on cold start, good enough for serverless)
const rateLimit = new Map();
const RATE_WINDOW = 60000; // 1 minute
const RATE_MAX = 20; // 20 messages per minute per IP

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

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  if (messages.length === 0 || messages.length > 40) return null;
  const cleaned = [];
  for (const m of messages) {
    if (!m || typeof m !== 'object') return null;
    if (m.role !== 'user' && m.role !== 'assistant') return null;
    if (typeof m.content !== 'string') return null;
    if (m.content.length > 4000) return null;
    cleaned.push({ role: m.role, content: m.content });
  }
  // Anthropic requires the conversation to end on a user turn
  if (cleaned[cleaned.length - 1].role !== 'user') return null;
  return cleaned;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://gambitco.io',
    'https://www.gambitco.io',
    'https://gambitwebsite.vercel.app',
  ];
  if (process.env.VERCEL_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000');
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Reject cross-origin browsers that didn't make it through the allowlist
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many requests. Slow down and try again in a minute.' });
  }

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid request body' });
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) {
    return res.status(400).json({ error: 'Invalid messages' });
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not configured');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: PROPOSAL_CONTEXT,
        messages,
      }),
    });

    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      console.error('Anthropic API error:', r.status, errText.slice(0, 500));
      return res.status(502).json({ error: 'Upstream error. Try again in a moment.' });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!text) {
      return res.status(502).json({ error: 'Empty response. Try again.' });
    }

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Chat proxy error:', err);
    return res.status(500).json({ error: 'Something went wrong. Try again.' });
  }
}
