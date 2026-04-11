const https = require('https');

const PLAN_LIMITS = { free: 50, creator: 500, pro: Infinity };
const FIREBASE_PROJECT = 'inkwell-app-619f9';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBTAN4kfoaea6RCwN0qUfeTbfqBwXigEDw';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Helpers ──────────────────────────────────────────

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
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Verify Firebase ID token using Google's tokeninfo endpoint
async function verifyIdToken(idToken) {
  const res = await httpJson(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );
  if (res.status !== 200 || !res.data?.users?.[0]?.localId) {
    return null;
  }
  return res.data.users[0].localId; // this is the uid
}

// Read a Firestore document using the user's token
async function firestoreGet(docPath, idToken) {
  const res = await httpJson(
    `${FIRESTORE_BASE}/${docPath}`,
    { headers: { 'Authorization': `Bearer ${idToken}` } }
  );
  if (res.status !== 200 || !res.data?.fields) return null;
  return firestoreDecode(res.data.fields);
}

// Write/update a Firestore document using unauthenticated REST + API key.
// Firestore rules must allow unauthenticated updates to the specific fields.
async function firestorePatch(docPath, fields) {
  const encoded = firestoreEncode(fields);
  const updateMask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
  await httpJson(
    `${FIRESTORE_BASE}/${docPath}?${updateMask}&key=${FIREBASE_API_KEY}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: encoded }),
    }
  );
}

// Decode Firestore field values → plain JS
function firestoreDecode(fields) {
  const obj = {};
  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) obj[key] = val.stringValue;
    else if ('integerValue' in val) obj[key] = parseInt(val.integerValue, 10);
    else if ('doubleValue' in val) obj[key] = val.doubleValue;
    else if ('booleanValue' in val) obj[key] = val.booleanValue;
    else if ('mapValue' in val) obj[key] = val.mapValue.fields ? firestoreDecode(val.mapValue.fields) : {};
    else obj[key] = null;
  }
  return obj;
}

// Encode plain JS → Firestore field values
function firestoreEncode(obj) {
  const fields = {};
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') fields[key] = { stringValue: val };
    else if (typeof val === 'number') fields[key] = Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
    else if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    else if (typeof val === 'object' && val !== null) fields[key] = { mapValue: { fields: firestoreEncode(val) } };
  }
  return fields;
}

// ── Main Handler ─────────────────────────────────────

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
    };
  }

  let incoming;
  try {
    incoming = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  // ── Auth + Usage Enforcement (REQUIRED) ─────────
  let uid = null;
  let plan = 'free';
  let aiUsage = { count: 0, periodStart: new Date().toISOString().slice(0, 7) };
  let remaining = null;
  const idToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');

  if (!idToken) {
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication required' }),
    };
  }

  try {
    uid = await verifyIdToken(idToken);
    if (!uid) {
      return {
        statusCode: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid authentication token' }),
      };
    }
  } catch (authErr) {
    return {
      statusCode: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authentication failed' }),
    };
  }

  try {
    // Read prefs using the user's own token (respects Firestore rules)
    const prefs = await firestoreGet(`users/${uid}/prefs/current`, idToken);
    if (prefs) {
      plan = prefs.plan || 'free';
      aiUsage = prefs.aiUsage || aiUsage;
    }

    // Lazy monthly reset
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (aiUsage.periodStart !== currentMonth) {
      aiUsage = { count: 0, periodStart: currentMonth };
    }

    // Enforce limit
    const limit = PLAN_LIMITS[plan] || 50;
    if (limit !== Infinity && aiUsage.count >= limit) {
      return {
        statusCode: 429,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'limit_reached', used: aiUsage.count, limit, plan }),
      };
    }

    // Increment usage
    aiUsage.count += 1;
    remaining = limit === Infinity ? null : (limit - aiUsage.count);

    // Write back usage (non-blocking, unauthenticated PATCH allowed by rules)
    firestorePatch(`users/${uid}/prefs/current`, { aiUsage }).catch(() => {});
  } catch (usageErr) {
    console.warn('Usage check failed:', usageErr.message);
    // Fail closed — don't serve AI if we can't track usage
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Usage tracking failed' }),
    };
  }

  // ── Proxy to Anthropic ───────────────────────────
  const messages = incoming.messages || [];
  const systemMsg = messages.find(m => m.role === 'system');
  const conversationMsgs = messages.filter(m => m.role !== 'system');

  const anthropicPayload = {
    model: 'claude-haiku-4-5',
    max_tokens: incoming.max_tokens || 1024,
    messages: conversationMsgs,
    ...(systemMsg ? { system: systemMsg.content } : {}),
  };

  const bodyStr = JSON.stringify(anthropicPayload);

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({
            statusCode: res.statusCode,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            body: data,
          });
          return;
        }

        let responseBody;
        try {
          const anthropicResponse = JSON.parse(data);
          const text = anthropicResponse.content?.[0]?.text || '';
          responseBody = JSON.stringify({
            choices: [{ message: { role: 'assistant', content: text } }],
          });
        } catch (e) {
          responseBody = JSON.stringify({ error: 'Failed to parse Anthropic response' });
        }

        const responseHeaders = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
        if (remaining !== null) {
          responseHeaders['X-AI-Remaining'] = String(remaining);
          responseHeaders['Access-Control-Expose-Headers'] = 'X-AI-Remaining';
        }

        resolve({
          statusCode: 200,
          headers: responseHeaders,
          body: responseBody,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: err.message }),
      });
    });

    req.write(bodyStr);
    req.end();
  });
};
