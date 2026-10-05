/**
 * api/chat.js -- Vercel Serverless Function
 *
 * Proxies chat requests from the browser to OpenRouter.
 * The OPENROUTER_API_KEY is read only on the server; it is NEVER
 * sent to or accessible by the browser.
 *
 * POST /api/chat
 * Body:     { messages: [{ role: "user"|"assistant"|"system", content: string }] }
 * Response: { ok: true, message: string } | { ok: false, error: string }
 *
 * Environment variables:
 *   OPENROUTER_API_KEY       (required)
 *   OPENROUTER_MODEL         (optional — primary model, defaults to DEFAULT_MODEL)
 *   OPENROUTER_FALLBACK_MODEL (optional — used after primary exhausts retries on 429)
 *
 * Retry behaviour (429 only):
 *   Up to MAX_RETRIES attempts on the primary model with exponential backoff.
 *   If all retries are exhausted, the fallback model is tried once.
 *   If no fallback is configured, a friendly error is returned.
 */

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Default to a confirmed-working free model.
// Override with OPENROUTER_MODEL env var.
const DEFAULT_MODEL   = 'qwen/qwen3.8-27b:free';

// Retry config — only applied to HTTP 429 responses.
const MAX_RETRIES      = 2;          // total extra attempts (primary tried MAX_RETRIES+1 times total)
const BASE_DELAY_MS    = 800;        // first back-off delay; doubles each attempt

// Payload limits (unchanged from original).
const MAX_BODY_BYTES   = 32768;
const MAX_MESSAGES     = 20;
const MAX_MSG_LENGTH   = 2000;

// ---------------------------------------------------------------------------
// System prompt (unchanged from original)
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are Puja AI, the official AI assistant for Pujo Planner.

You specialize in Kolkata Durga Puja.

You help users with:
- Durga Puja information
- pandal hopping
- Kolkata areas
- metro travel
- trip planning
- safety
- navigation guidance

Do not invent pandal names, metro stations, coordinates, distances or verification status.

When application data is provided, treat that data as authoritative.

If the application does not provide enough information, clearly say that you do not have verified information.

Answer naturally in Bengali when the user writes Bengali.
Answer in English when the user writes English.

Keep normal responses concise and helpful (under 150 words). Use bullet points (•) where appropriate.

When a destination or pandal is detected, provide helpful guidance and recommend using Pujo Planner's interactive pandal and metro cards.`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sleep for `ms` milliseconds. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call the OpenRouter completions endpoint once for a given model.
 *
 * Returns an object:
 *   { ok: true,  message: string }          — success
 *   { ok: false, status: number, fatal: bool } — failure
 *     fatal=true  → do NOT retry (4xx other than 429, or parse errors)
 *     fatal=false → may retry (429, 5xx)
 *
 * The API key is NEVER included in the return value.
 */
async function callOpenRouter(apiKey, model, messages) {
  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
    ],
    max_tokens:  512,
    temperature: 0.7,
    // Qwen3 and similar reasoning models put output in 'reasoning' by default;
    // effort:'low' keeps tokens minimal and ensures content lands in
    // the standard message.content field that we extract below.
    reasoning: { effort: 'low' },
  };

  let orRes;
  try {
    orRes = await fetch(OPENROUTER_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
        'HTTP-Referer':  'https://pujo-planner.vercel.app',
        'X-Title':       'Pujo Planner Puja AI',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error('[puja-ai] Network error:', networkErr.message);
    return { ok: false, status: 0, fatal: false }; // transient — allow retry
  }

  if (!orRes.ok) {
    // 429 and 5xx are transient; all others are fatal.
    const fatal = orRes.status !== 429 && orRes.status < 500;
    return { ok: false, status: orRes.status, fatal };
  }

  let orJson;
  try {
    orJson = await orRes.json();
  } catch {
    return { ok: false, status: orRes.status, fatal: true };
  }

  const message = orJson?.choices?.[0]?.message?.content?.trim();
  if (!message) {
    return { ok: false, status: orRes.status, fatal: true };
  }

  return { ok: true, message };
}

/**
 * Call OpenRouter with automatic retry on transient failures (429 / 5xx).
 * Uses exponential backoff: BASE_DELAY_MS, BASE_DELAY_MS*2, BASE_DELAY_MS*4 …
 *
 * Returns the same shape as callOpenRouter().
 */
async function callWithRetry(apiKey, model, messages, maxRetries) {
  let lastResult;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[puja-ai] retry ${attempt} (${delay}ms backoff, model: ${model})`);
      await sleep(delay);
    }

    lastResult = await callOpenRouter(apiKey, model, messages);

    if (lastResult.ok)    return lastResult; // success
    if (lastResult.fatal) return lastResult; // permanent error — no point retrying

    // transient (429 / 5xx / network) — log and loop
    if (lastResult.status === 429) {
      console.warn(`[puja-ai] primary model rate limited (attempt ${attempt + 1}/${maxRetries + 1})`);
    } else {
      console.warn(`[puja-ai] transient error ${lastResult.status} (attempt ${attempt + 1}/${maxRetries + 1})`);
    }
  }

  return lastResult; // all retries exhausted
}

// ---------------------------------------------------------------------------
// User-facing error messages
// ---------------------------------------------------------------------------
const STATUS_MESSAGES = {
  0:   'দুঃখিত, AI সার্ভিসে পৌঁছানো যাচ্ছে না। আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন।',
  400: 'AI সার্ভিস অনুরোধটি বুঝতে পারেনি।',
  401: 'AI সার্ভিস কনফিগারেশন সমস্যা। সাইট অ্যাডমিনের সাথে যোগাযোগ করুন।',
  403: 'AI সার্ভিস অ্যাক্সেস সমস্যা। সাইট অ্যাডমিনের সাথে যোগাযোগ করুন।',
  404: 'AI মডেল পাওয়া যাচ্ছে না। সাইট অ্যাডমিনের সাথে যোগাযোগ করুন।',
  429: 'এই মুহূর্তে AI পরিষেবায় অনেক বেশি অনুরোধ রয়েছে। একটু পরে আবার চেষ্টা করুন।',
  500: 'দুঃখিত, AI পরিষেবায় একটু সমস্যা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  502: 'দুঃখিত, AI পরিষেবায় একটু সমস্যা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  503: 'দুঃখিত, AI পরিষেবা এই মুহূর্তে অনুপলব্ধ। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
  504: 'দুঃখিত, AI পরিষেবা সময়মতো সাড়া দেয়নি। আবার চেষ্টা করুন।',
};

const GENERIC_ERROR = 'দুঃখিত, এই মুহূর্তে AI পরিষেবায় একটু সমস্যা হচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।';

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // --- API key (server-side only, never returned to client) -----------------
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('[puja-ai] OPENROUTER_API_KEY is not set');
    return res.status(503).json({ ok: false, error: 'AI service is not configured.' });
  }

  const primaryModel  = process.env.OPENROUTER_MODEL         || DEFAULT_MODEL;
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || '';

  // --- Payload size guard ---------------------------------------------------
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return res.status(413).json({ ok: false, error: 'Request too large.' });
  }

  // --- Parse body -----------------------------------------------------------
  let body;
  try {
    body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON.' });
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return res.status(400).json({ ok: false, error: 'messages array is required.' });
  }

  // --- Sanitise messages ---------------------------------------------------
  const rawMessages = body.messages.slice(-MAX_MESSAGES);
  const messages    = [];

  for (const msg of rawMessages) {
    if (!msg || typeof msg !== 'object') continue;
    const role    = String(msg.role    || '').trim();
    const content = String(msg.content || '').trim();
    if (!['user', 'assistant', 'system'].includes(role)) continue;
    if (!content) continue;
    messages.push({ role, content: content.slice(0, MAX_MSG_LENGTH) });
  }

  if (messages.length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid messages provided.' });
  }

  // --- Try primary model with retries --------------------------------------
  console.log(`[puja-ai] calling primary model: ${primaryModel}`);
  let result = await callWithRetry(apiKey, primaryModel, messages, MAX_RETRIES);

  // --- Try fallback model (only on transient failures) ---------------------
  if (!result.ok && !result.fatal && fallbackModel && fallbackModel !== primaryModel) {
    console.warn(`[puja-ai] switching to fallback model: ${fallbackModel}`);
    result = await callOpenRouter(apiKey, fallbackModel, messages);
    if (!result.ok) {
      console.error(`[puja-ai] fallback model also failed (status ${result.status})`);
    }
  } else if (!result.ok && !result.fatal && !fallbackModel) {
    console.warn('[puja-ai] no fallback model configured; returning 429 error to client');
  }

  // --- Handle final failure ------------------------------------------------
  if (!result.ok) {
    const userMsg = STATUS_MESSAGES[result.status] ?? GENERIC_ERROR;
    console.error(`[puja-ai] final failure — status ${result.status}`);
    // Always return 502 to the browser (never leak internal status codes).
    return res.status(502).json({ ok: false, error: userMsg });
  }

  // --- Success -------------------------------------------------------------
  return res.status(200).json({ ok: true, message: result.message });
}
