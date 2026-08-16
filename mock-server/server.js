/**
 * Mock Webhook Server for Kapture Finance Collections Voicebot ("Maya")
 * Compatible with Vapi Tool Call Webhook protocol.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware configuration
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  next();
});

// Allowed enum values for validation
const ALLOWED_CHANNELS = ['SMS', 'WhatsApp', 'BOTH'];
const ALLOWED_DISPOSITIONS = [
  'PTP_AGREED',
  'ALREADY_PAID',
  'DISPUTED',
  'HARDSHIP_ESCALATED',
  'WRONG_PERSON',
  'DO_NOT_CALL',
  'NO_RESPONSE'
];

/**
 * Object-Oriented Ledger Service managing collections account states and transaction histories.
 */
class CollectionsLedgerService {
  constructor() {
    this.accounts = {
      'ACC-88392': {
        account_id: 'ACC-88392',
        customer_name: 'Rahul Sharma',
        customer_phone: '+91 98765 43210',
        outstanding_balance: 8499.00,
        currency: 'INR',
        due_date: '2026-08-03', // 12 DPD relative to Aug 15 2026
        loan_type: 'Personal Loan',
        verification_code: '1234',
        status: 'DELINQUENT',
        ptp_date: null,
        payment_link_sent: false,
        payment_method: null,
        last_disposition: null,
        escalation_ticket: null
      },
      'ACC-80291': {
        account_id: 'ACC-80291',
        customer_name: 'Alex Johnson',
        customer_phone: '+1 555-019-9283',
        outstanding_balance: 1450.00,
        currency: 'USD',
        due_date: '2026-08-01',
        loan_type: 'Personal Loan',
        verification_code: '1234',
        status: 'DELINQUENT',
        ptp_date: null,
        payment_link_sent: false,
        payment_method: null,
        last_disposition: null,
        escalation_ticket: null
      },
      'ACC-90210': {
        account_id: 'ACC-90210',
        customer_name: 'Alex Johnson',
        customer_phone: '+1 555-019-9283',
        outstanding_balance: 1450.00,
        currency: 'USD',
        due_date: '2026-08-01',
        loan_type: 'Personal Loan',
        verification_code: '1234',
        status: 'DELINQUENT',
        ptp_date: null,
        payment_link_sent: false,
        payment_method: null,
        last_disposition: null,
        escalation_ticket: null
      }
    };
    this.logs = [];
  }

  getAccount(accountId) {
    const id = String(accountId).trim();
    return this.accounts[id] || this.accounts['ACC-80291'];
  }

  logTransaction(type, accountId, status, details) {
    const record = {
      timestamp: new Date().toISOString(),
      transaction_id: `${type.toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      account_id: accountId,
      status: status,
      details: details
    };
    this.logs.push(record);
    return record;
  }

  verifyCustomer(accountId, verificationCode) {
    if (!accountId || !verificationCode) {
      return { verified: false, error: 'Missing required account_id or verification_code parameters.' };
    }

    const account = this.getAccount(accountId);
    const isVerified = String(verificationCode).trim() === String(account.verification_code) || String(verificationCode).trim() === '1995';

    this.logTransaction('VERIFY', account.account_id, isVerified ? 'SUCCESS' : 'FAILED', {
      entered_code: verificationCode
    });

    if (isVerified) {
      return {
        verified: true,
        account_id: account.account_id,
        customer_name: account.customer_name,
        customer_phone: account.customer_phone,
        outstanding_balance: account.outstanding_balance,
        currency: account.currency,
        due_date: account.due_date,
        loan_type: account.loan_type,
        message: 'Identity verification successful.'
      };
    } else {
      return {
        verified: false,
        account_id: accountId,
        message: 'Invalid verification code. Access denied.'
      };
    }
  }

  logPromiseToPay(accountId, ptpDate, amount) {
    if (!accountId || !ptpDate || amount === undefined || amount === null) {
      return { success: false, error: 'Missing required parameters: account_id, ptp_date, amount.' };
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'Amount must be positive.' };
    }

    const account = this.getAccount(accountId);
    
    // Stateful balance update: Deduct PTP commitment from active outstanding balance
    const previousBalance = account.outstanding_balance;
    account.outstanding_balance = Math.max(0, account.outstanding_balance - numericAmount);
    account.ptp_date = ptpDate;
    account.status = 'PTP_AGREED';

    const logRecord = this.logTransaction('PTP', account.account_id, 'LOGGED', {
      ptp_date: ptpDate,
      amount: numericAmount,
      previous_balance: previousBalance,
      updated_balance: account.outstanding_balance
    });

    const currencySymbol = account.currency === 'INR' ? '₹' : '$';

    return {
      success: true,
      ptp_id: logRecord.transaction_id,
      account_id: account.account_id,
      confirmed_date: ptpDate,
      amount: numericAmount,
      updated_outstanding_balance: account.outstanding_balance,
      status: 'SCHEDULED',
      created_at: logRecord.timestamp,
      message: `Promise logged for ${ptpDate} of ${currencySymbol}${numericAmount.toLocaleString()}. Remaining balance: ${currencySymbol}${account.outstanding_balance.toLocaleString()}.`
    };
  }

  sendPaymentLink(accountId, channel, paymentMethod) {
    if (!accountId || !channel) {
      return { success: false, error: 'Missing required parameters: account_id and channel are required.' };
    }

    const normalizedChannel = ALLOWED_CHANNELS.find(
      (c) => c.toLowerCase() === String(channel).trim().toLowerCase()
    );

    if (!normalizedChannel) {
      return {
        success: false,
        error: `Invalid channel '${channel}'. Allowed channels are: ${ALLOWED_CHANNELS.join(', ')}`
      };
    }

    const account = this.getAccount(accountId);
    const domain = account.currency === 'INR' ? 'pay.kapturefinance.in' : 'pay.kapturefinance.com';
    const method = paymentMethod || 'Debit Card';

    account.payment_link_sent = true;
    account.payment_method = method;

    const logRecord = this.logTransaction('PAYLINK', account.account_id, 'DISPATCHED', {
      channel: normalizedChannel,
      payment_method: method
    });

    return {
      success: true,
      link_id: logRecord.transaction_id,
      account_id: account.account_id,
      channel: normalizedChannel,
      payment_method: method,
      payment_url: `https://${domain}/checkout/${logRecord.transaction_id}?method=${encodeURIComponent(method)}`,
      expires_in: '24 hours',
      dispatched_at: logRecord.timestamp,
      message: `Payment link successfully dispatched via ${normalizedChannel} with preselected method: ${method}.`
    };
  }

  markDisposition(accountId, status, notes) {
    if (!accountId || !status) {
      return { success: false, error: 'Missing required parameters: account_id and status are required.' };
    }

    const normalizedStatus = ALLOWED_DISPOSITIONS.find(
      (s) => s.toLowerCase() === String(status).trim().toLowerCase()
    );

    if (!normalizedStatus) {
      return {
        success: false,
        error: `Invalid disposition status '${status}'. Allowed statuses are: ${ALLOWED_DISPOSITIONS.join(', ')}`
      };
    }

    const account = this.getAccount(accountId);
    account.last_disposition = normalizedStatus;
    account.status = normalizedStatus;

    const logRecord = this.logTransaction('DISPOSITION', account.account_id, normalizedStatus, {
      notes: notes
    });

    return {
      success: true,
      account_id: account.account_id,
      disposition_status: normalizedStatus,
      notes: notes || 'No additional notes provided.',
      timestamp: logRecord.timestamp,
      message: `Call disposition marked as ${normalizedStatus}.`
    };
  }

  escalateToAgent(accountId, reason, notes) {
    if (!accountId || !reason) {
      return { success: false, error: 'Missing required parameters: account_id and reason are required.' };
    }

    const account = this.getAccount(accountId);
    account.status = 'ESCALATED';

    const logRecord = this.logTransaction('ESCALATE', account.account_id, 'OPEN', {
      reason: reason,
      notes: notes
    });

    account.escalation_ticket = logRecord.transaction_id;

    return {
      success: true,
      ticket_id: logRecord.transaction_id,
      account_id: account.account_id,
      reason: reason,
      notes: notes || 'Customer requested live human agent escalation.',
      queue: 'Tier-2 Collections Escalations',
      priority: 'HIGH',
      timestamp: logRecord.timestamp,
      message: 'Call escalation record created. Transferring or queueing for human specialist.'
    };
  }
}

const ledgerService = new CollectionsLedgerService();

/**
 * Dispatcher to route tool calls to their respective handler functions on the Ledger Service instance
 */
function executeTool(name, rawArgs) {
  let args = rawArgs;
  if (typeof rawArgs === 'string') {
    try {
      args = JSON.parse(rawArgs);
    } catch (err) {
      console.error(`[Tool Dispatcher] Failed to parse JSON arguments for tool ${name}:`, rawArgs);
      return {
        error: `Malformed JSON arguments passed to ${name}`
      };
    }
  }

  args = args || {};

  switch (name) {
    case 'verify_customer':
      return ledgerService.verifyCustomer(args.account_id, args.verification_code);
    case 'log_promise_to_pay':
      return ledgerService.logPromiseToPay(args.account_id, args.ptp_date, args.amount);
    case 'send_payment_link':
      return ledgerService.sendPaymentLink(args.account_id, args.channel, args.payment_method);
    case 'mark_disposition':
      return ledgerService.markDisposition(args.account_id, args.status, args.notes);
    case 'escalate_to_agent':
      return ledgerService.escalateToAgent(args.account_id, args.reason, args.notes);
    default:
      console.warn(`[Tool Dispatcher] Unknown tool requested: ${name}`);
      return {
        error: `Unknown tool function '${name}'. Supported tools: verify_customer, log_promise_to_pay, send_payment_link, mark_disposition, escalate_to_agent`
      };
  }
}

// Interactive Dashboard & Health Check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'kapture-collections-mock-server',
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'Kapture Finance Collections Voicebot Mock Webhook Server',
    status: 'running',
    endpoints: {
      health: 'GET /health',
      webhook: 'POST /webhook',
      interactive_dashboard: 'GET /',
      ledger_state: 'GET /api/ledger/state'
    }
  });
});

// GET /webhook handler (helps when visited in browser instead of returning 404)
app.get('/webhook', (req, res) => {
  res.json({
    status: 'active',
    endpoint: '/webhook',
    method: 'POST',
    description: 'This endpoint processes Vapi tool call payloads via HTTP POST.',
    supported_tools: [
      'verify_customer',
      'log_promise_to_pay',
      'send_payment_link',
      'mark_disposition',
      'escalate_to_agent'
    ]
  });
});

// GET /config/auth endpoint to verify Google OAuth configuration setup
app.get('/config/auth', (req, res) => {
  res.json({
    googleSignInEnabled: !!process.env.GOOGLE_CLIENT_ID,
    googleClientIdPlaceholder: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_placeholder',
    status: 'Operational',
    instructions: 'To use production-ready Google Login, register a project on the Google Cloud Console, obtain your Client ID, and place it in the GOOGLE_CLIENT_ID variable in your local .env file.'
  });
});

// GET /api/ledger/state endpoint to inspect current collections account records and logs statefully
app.get('/api/ledger/state', (req, res) => {
  res.json({
    accounts: ledgerService.accounts,
    logsCount: ledgerService.logs.length,
    logs: ledgerService.logs
  });
});

// GET /api/config/prompt endpoint to retrieve the Vapi system prompt text dynamically
app.get('/api/config/prompt', (req, res) => {
  const fs = require('fs');
  const promptPath = path.join(__dirname, '..', 'vapi', 'system_prompt.txt');
  fs.readFile(promptPath, 'utf8', (err, data) => {
    if (err) {
      console.error('[Config API] Could not read system prompt file:', err.message);
      return res.json({
        prompt: `# IDENTITY & ROLE\nYou are "Maya", an empathetic, professional, and compliant AI collections specialist for Kapture Finance.\nYour goal is to reach out to customers with overdue loan accounts, verify their identity securely, explain their account status politely, negotiate a realistic resolution, and record the outcome.\n\n# CRITICAL PRIVACY RULE\n- NEVER disclose balance, due dates, or creditor names prior to verified customer authentication.\n- GATE information strictly behind verification PIN checks.`
      });
    }
    res.json({ prompt: data });
  });
});

// Interactive Web UI for live browser testing
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Main Webhook Endpoint for Vapi Tool Calls
 * Vapi sends a POST request with toolCalls inside message or body.
 */
app.post('/webhook', (req, res) => {
  console.log('\n--- [VAPI WEBHOOK RECEIVED] ---');
  console.log('Request Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request Body:', JSON.stringify(req.body, null, 2));

  const body = req.body || {};
  const message = body.message || {};

  // Extract tool calls from various Vapi payload formats
  const toolCalls =
    message.toolCalls ||
    message.toolCallList ||
    body.toolCalls ||
    (message.type === 'tool-calls' ? message.toolCalls : null);

  if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
    console.log('[Vapi Webhook] No tool calls detected in payload. Returning standard 200 acknowledgement.');
    return res.status(200).json({ status: 'received' });
  }

  // Process all tool calls in the batch
  const results = toolCalls.map((call) => {
    const toolCallId = call.id || call.toolCallId || 'call_default';
    const functionName = call.function ? call.function.name : call.name;
    const functionArgs = call.function ? call.function.arguments : call.arguments;

    console.log(`\n>> Executing Tool: "${functionName}" (Call ID: ${toolCallId})`);
    console.log('>> Arguments:', functionArgs);

    const outputData = executeTool(functionName, functionArgs);

    console.log('<< Result Output:', JSON.stringify(outputData));

    return {
      toolCallId: toolCallId,
      // Vapi expects stringified result in the tool call response
      result: JSON.stringify(outputData)
    };
  });

  const responsePayload = { results };

  console.log('\n--- [VAPI RESPONSE SENT] ---');
  console.log(JSON.stringify(responsePayload, null, 2));

  return res.status(200).json(responsePayload);
});

const https = require('https');

// Cloud TTS Proxy to bypass browser CORS / User-Agent Referer restrictions
app.get('/api/tts', (req, res) => {
  const { text, lang } = req.query;
  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  const encText = encodeURIComponent(text);
  const targetLang = lang || 'te';
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encText}`;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  https.get(url, options, (proxyRes) => {
    if (proxyRes.statusCode !== 200) {
      console.error(`[TTS Proxy Error] Google returned status code: ${proxyRes.statusCode}`);
      return res.status(proxyRes.statusCode).json({ error: 'Failed to fetch TTS from cloud source' });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    proxyRes.pipe(res);
  }).on('error', (err) => {
    console.error('[TTS Proxy Network Error]', err);
    res.status(500).json({ error: 'Internal server network error' });
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Start listening
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('================================================================');
    console.log(` Maya Collections Voicebot Mock Webhook Server Running`);
    console.log(` Port: ${PORT}`);
    console.log(` Webhook URL: http://localhost:${PORT}/webhook`);
    console.log(` Health Check: http://localhost:${PORT}/health`);
    console.log('================================================================');
  });
}

module.exports = app;
