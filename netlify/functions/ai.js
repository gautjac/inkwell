const https = require('https');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  // Extract system message and user/assistant messages from OpenAI-format payload
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

        // Transform Anthropic response → OpenAI-compatible shape
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

        resolve({
          statusCode: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
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
