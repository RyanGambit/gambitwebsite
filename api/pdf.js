// Renders /dejero-proposal to a PDF via headless Chromium and streams it back
// as a file download. Skips the client-side gate by injecting sessionStorage
// into the Puppeteer context before navigation.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const PROPOSAL_PASSWORD = process.env.DEJERO_PROPOSAL_PASSWORD || 'beacon2026';
const FILENAME = 'Gambit-Dejero-Beacon-Proposal.pdf';

// Simple in-memory rate limiting (resets on cold start)
const rateLimit = new Map();
const RATE_WINDOW = 60_000;
const RATE_MAX = 6; // 6 PDF renders per minute per IP

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

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden origin' });
  }

  // Rate limit
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';
  if (!checkRate(ip)) {
    return res.status(429).json({ error: 'Too many downloads. Wait a minute and try again.' });
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

  // Auth: require the proposal password. Same shared-secret the gate uses.
  const auth = typeof body.auth === 'string' ? body.auth.trim().toLowerCase() : '';
  if (auth !== PROPOSAL_PASSWORD.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Derive the absolute URL of the proposal page for Puppeteer to navigate to
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host;
  const url = `${protocol}://${host}/dejero-proposal`;

  let browser;
  let stage = 'init';
  try {
    stage = 'resolve-executable';
    const executablePath = await chromium.executablePath();

    stage = 'launch-chromium';
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--hide-scrollbars',
        '--disable-dev-shm-usage',
        '--disable-web-security',
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    });

    stage = 'new-page';
    const page = await browser.newPage();

    // Bypass the client-side gate by pre-seeding sessionStorage before any
    // script runs on the page.
    stage = 'inject-session';
    await page.evaluateOnNewDocument(() => {
      try {
        sessionStorage.setItem('dejero_proposal_auth_v1', '1');
        sessionStorage.setItem('dejero_proposal_welcome_seen_v1', '1');
      } catch (e) {}
    });

    // Hide chat widget + FAB at render time as a second line of defense
    // on top of the print CSS.
    stage = 'inject-style';
    await page.evaluateOnNewDocument(() => {
      const s = document.createElement('style');
      s.textContent = '[data-chat-widget],[data-chat-fab]{display:none !important}';
      document.documentElement.appendChild(s);
    });

    stage = 'goto';
    // Use domcontentloaded (not networkidle0). networkidle0 can hang on
    // font-foundry connections or analytics beacons.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25_000 });

    stage = 'wait-for-content';
    await page.waitForSelector('[data-proposal-wrap] .band', { timeout: 15_000 });

    // Let webfonts settle (cap wait at 5s so we don't hang forever if fontshare fails).
    stage = 'wait-for-fonts';
    try {
      await Promise.race([
        page.evaluate(() => document.fonts && document.fonts.ready),
        new Promise(r => setTimeout(r, 5000)),
      ]);
    } catch (e) {
      // font readiness is best-effort
    }
    // Extra settle tick for layout
    await new Promise(r => setTimeout(r, 400));

    stage = 'render-pdf';
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      timeout: 30_000,
    });

    stage = 'respond';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${FILENAME}"`);
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).send(Buffer.from(pdf));
  } catch (err) {
    // Surface enough detail in the logs to diagnose which stage failed
    console.error(`PDF render error at stage "${stage}":`, err?.message || err);
    if (err?.stack) console.error(err.stack);
    return res.status(500).json({
      error: 'PDF generation failed. Try again in a moment.',
      stage,
      detail: err?.message?.slice(0, 300) || 'unknown',
    });
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
    }
  }
}

// Vercel function config: give it room to launch Chromium and render
export const config = {
  maxDuration: 60,
};
