const https = require('https');

const FIREBASE_PROJECT = 'inkwell-app-619f9';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/(default)/documents`;

// Firestore REST helpers (using API key for server-side writes)
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
    else if (typeof val === 'object' && val !== null) fields[key] = { mapValue: { fields: firestoreEncode(val) } };
  }
  return fields;
}

// Price ID → plan mapping
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRICE_CREATOR || 'price_creator']: 'creator',
  [process.env.STRIPE_PRICE_PRO || 'price_pro']: 'pro',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify Stripe webhook signature
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Use Firebase API key for server-side Firestore writes
  // The Firestore rules allow writes when auth matches, but for webhook (no user token),
  // we use the REST API with the API key. The security rules need to allow this path
  // for the webhook, or we use a service account. Since we can't get a service account,
  // we'll write via the REST API using the Firebase API key (public, but Firestore rules
  // should have a special rule for plan updates from trusted sources).
  //
  // ALTERNATIVE: Since Firestore rules block unauthenticated writes, the webhook
  // stores the plan update in a simple JSON store or uses Netlify Blobs.
  // For now, we use the Firebase REST API — you may need to add a temporary
  // Firestore rule to allow writes to the 'plan' field from the server.
  const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyBuEpnxGya3KgBRjfuz4hvwz_i7BOZFHTU';

  async function updateUserPlan(firebaseUid, plan, stripeCustomerId) {
    const docPath = `users/${firebaseUid}/prefs/current`;
    const fields = firestoreEncode({ plan, stripeCustomerId: stripeCustomerId || '' });
    const updateMask = 'updateMask.fieldPaths=plan&updateMask.fieldPaths=stripeCustomerId';
    const res = await httpJson(
      `${FIRESTORE_BASE}/${docPath}?${updateMask}&key=${FIREBASE_API_KEY}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      }
    );
    if (res.status !== 200) {
      console.error('Firestore update failed:', res.status, JSON.stringify(res.data));
    }
    return res;
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const firebaseUid = session.metadata?.firebaseUid;
        const priceId = session.metadata?.priceId;
        if (firebaseUid) {
          const plan = PRICE_TO_PLAN[priceId] || 'creator';
          await updateUserPlan(firebaseUid, plan, session.customer);
          console.log(`User ${firebaseUid} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        // For cancellations, we need the firebaseUid from subscription metadata
        const subscription = stripeEvent.data.object;
        const firebaseUid = subscription.metadata?.firebaseUid;
        if (firebaseUid) {
          await updateUserPlan(firebaseUid, 'free', subscription.customer);
          console.log(`User ${firebaseUid} reverted to free`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return { statusCode: 500, body: 'Internal error' };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
