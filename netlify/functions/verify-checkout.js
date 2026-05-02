// Server-side verification of Stripe checkout sessions.
// Called by the client after Stripe redirects back with session_id.
// Verifies the session is paid, reads the plan from metadata,
// writes the plan to Firestore via unauthenticated PATCH.

const https = require('https');

const FIREBASE_PROJECT = 'inkwell-app-619f9';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBuEpnxGya3KgBRjfuz4hvwz_i7BOZFHTU';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function httpJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function firestoreEncode(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
  }
  return fields;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers: CORS_HEADERS, body: 'Invalid JSON' }; }

  const { sessionId } = body;
  if (!sessionId) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing sessionId' }),
    };
  }

  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

  try {
    // Verify session with Stripe directly — the source of truth
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return {
        statusCode: 402,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Session not paid', status: session.payment_status }),
      };
    }

    const firebaseUid = session.metadata?.firebaseUid;
    const priceId = session.metadata?.priceId;

    if (!firebaseUid) {
      return {
        statusCode: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No firebaseUid in session metadata' }),
      };
    }

    // Map priceId to plan name
    const PRICE_TO_PLAN = {
      [process.env.STRIPE_PRICE_CREATOR || '']: 'creator',
      [process.env.STRIPE_PRICE_PRO || '']: 'pro',
    };
    const plan = PRICE_TO_PLAN[priceId] || 'creator';

    // Update Firestore using unauthenticated PATCH (rules allow plan + stripeCustomerId)
    const fields = firestoreEncode({ plan, stripeCustomerId: session.customer || '' });
    const updateMask = 'updateMask.fieldPaths=plan&updateMask.fieldPaths=stripeCustomerId';
    const res = await httpJson(
      `${FIRESTORE_BASE}/users/${firebaseUid}/prefs/current?${updateMask}&key=${FIREBASE_API_KEY}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      }
    );

    if (res.status !== 200) {
      console.error('Firestore update failed:', res.status, JSON.stringify(res.data));
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to update plan in Firestore' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, success: true }),
    };
  } catch (err) {
    console.error('Verify checkout error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
