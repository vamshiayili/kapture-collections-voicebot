/**
 * Automated dynamic test runner for Kapture Collections Voicebot Mock Server.
 * Executes all test cases declared in tests/test_cases.json.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const SERVER_PORT = process.env.PORT || 3000;
const HOST = 'localhost';

function postWebhook(payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: HOST,
        port: SERVER_PORT,
        path: '/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, raw: body });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(data);
    req.end();
  });
}

/**
 * Recursively verify that the actual response object matches all fields of expected output
 */
function verifyObject(actual, expected) {
  for (const [key, val] of Object.entries(expected)) {
    if (actual[key] === undefined) {
      return { ok: false, reason: `Missing key: "${key}"` };
    }
    if (typeof val === 'object' && val !== null) {
      const subCheck = verifyObject(actual[key], val);
      if (!subCheck.ok) return subCheck;
    } else {
      if (actual[key] !== val) {
        return { ok: false, reason: `Value mismatch for "${key}": expected "${val}", got "${actual[key]}"` };
      }
    }
  }
  return { ok: true };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 Starting Automated Webhook Tool Integration Tests');
  console.log(` Targeting: http://${HOST}:${SERVER_PORT}/webhook`);
  console.log('================================================================\n');
  
  let testCasesData;
  try {
    const filePath = path.join(__dirname, 'test_cases.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    testCasesData = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Failed to load test_cases.json:', err.message);
    process.exit(1);
  }

  const cases = testCasesData.test_cases;
  let passedCount = 0;

  for (const tc of cases) {
    console.log(`[${tc.id}] Tool: "${tc.tool}" | ${tc.description}`);

    try {
      const res = await postWebhook(tc.payload);
      
      if (res.statusCode !== 200) {
        throw new Error(`HTTP Status Code is ${res.statusCode}, expected 200`);
      }

      if (!res.data || !res.data.results || !res.data.results[0]) {
        throw new Error(`Malformed response structure: ${JSON.stringify(res.data)}`);
      }

      const resultString = res.data.results[0].result;
      const resultObj = JSON.parse(resultString);

      const verification = verifyObject(resultObj, tc.expected_output);
      if (!verification.ok) {
        throw new Error(verification.reason);
      }

      console.log(`  └─> Output Verified: verified=true`);
      console.log(`✅ Passed!\n`);
      passedCount++;
    } catch (err) {
      console.error(`❌ ${tc.id} Failed:`, err);
      console.error('--------------------------------------------------\n');
      process.exit(1);
    }
  }

  console.log('================================================================');
  console.log(`🎉 SUCCESS: ALL ${passedCount} INTEGRATION TESTS PASSED!`);
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test execution crashed:', err);
  process.exit(1);
});
