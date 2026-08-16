# System Architecture & Technical Specifications

## 1. Architectural Overview

```
 ┌───────────────────────────────────────────────────────────┐
 │                   Borrower / Customer PSTN                │
 └─────────────────────────────┬─────────────────────────────┘
                               │ Inbound/Outbound Audio Stream
                               ▼
 ┌───────────────────────────────────────────────────────────┐
 │                  Vapi Voice AI Platform                   │
 │                                                           │
 │  ┌─────────────────┐ ┌──────────────────┐ ┌────────────┐  │
 │  │ Deepgram Nova-2 │ │ OpenAI GPT-4o-mini│ │ ElevenLabs │  │
 │  │   (Realtime STT)│ │ (Reasoning / LLM)│ │ (Fast TTS) │  │
 │  └─────────────────┘ └────────┬─────────┘ └────────────┘  │
 └───────────────────────────────┼───────────────────────────┘
                                 │ HTTP POST /webhook (JSON)
                                 ▼
 ┌───────────────────────────────────────────────────────────┐
 │        Mock Integration Server (Node.js / Express)        │
 │                                                           │
 │  ┌─────────────────────────────────────────────────────┐  │
 │  │ Webhook Router & Request Parser                     │  │
 │  └────────────────────────┬────────────────────────────┘  │
 │                           │                               │
 │       ┌───────────────────┼───────────────────┐           │
 │       ▼                   ▼                   ▼           │
 │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
 │  │ Customer Auth│   │ Promise-to-  │   │ Payment Link │   │
 │  │ Verification │   │  Pay Ledger  │   │  Dispatcher  │   │
 │  └──────────────┘   └──────────────┘   └──────────────┘   │
 │       │                   │                   │           │
 │       ▼                   ▼                   ▼           │
 │  ┌──────────────┐   ┌──────────────┐                      │
 │  │ Call Outcome │   │ Agent Ticket │                      │
 │  │ Disposition  │   │  Escalation  │                      │
 │  └──────────────┘   └──────────────┘                      │
 └───────────────────────────────────────────────────────────┘
```

---

## 2. API Contract & Tool Schema

All tools communicate over standard HTTP POST requests to `/webhook`.

### Vapi Request Payload Format
```json
{
  "message": {
    "type": "tool-calls",
    "toolCalls": [
      {
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "verify_customer",
          "arguments": {
            "account_id": "ACC-10928",
            "verification_code": "1234"
          }
        }
      }
    ]
  }
}
```

### Vapi Response Payload Format
```json
{
  "results": [
    {
      "toolCallId": "call_abc123",
      "result": "{\"verified\":true,\"account_id\":\"ACC-10928\",\"customer_name\":\"Alex Johnson\",\"outstanding_balance\":1450,\"currency\":\"USD\",\"due_date\":\"2026-08-01\"}"
    }
  ]
}
```

---

## 3. Tool Specifications & Business Rules

### 1. `verify_customer`
* **Purpose**: Enforce customer identity verification before revealing debt or loan numbers.
* **Arguments**:
  * `account_id` (string, required)
  * `verification_code` (string, required)
* **Logic**:
  * If `verification_code` is `"1234"` or `"1995"`, returns `verified: true` with loan balance and due date.
  * Any other value returns `verified: false`.

### 2. `log_promise_to_pay`
* **Purpose**: Schedule borrower's promised payment commitment.
* **Arguments**:
  * `account_id` (string, required)
  * `ptp_date` (string `YYYY-MM-DD`, required)
  * `amount` (number, required)
* **Response**: Returns unique `ptp_id`, confirmed date, amount, and timestamp.

### 3. `send_payment_link`
* **Purpose**: Instant checkout link generation dispatched via digital channels.
* **Arguments**:
  * `account_id` (string, required)
  * `channel` (enum: `SMS`, `WhatsApp`, `BOTH`, required)
* **Response**: Returns unique `link_id`, checkout URL, and expiration window.

### 4. `mark_disposition`
* **Purpose**: Categorize call wrap-up for analytics and CRM sync.
* **Arguments**:
  * `account_id` (string, required)
  * `status` (enum: `PTP_AGREED`, `ALREADY_PAID`, `DISPUTED`, `HARDSHIP_ESCALATED`, `WRONG_PERSON`, `DO_NOT_CALL`, `NO_RESPONSE`, required)
  * `notes` (string, optional)
* **Response**: Returns updated status, timestamp, and audit confirmation.

### 5. `escalate_to_agent`
* **Purpose**: Route customer to human tier-2 support when automated resolution is not feasible.
* **Arguments**:
  * `account_id` (string, required)
  * `reason` (string, required)
  * `notes` (string, optional)
* **Response**: Returns `ticket_id`, routing queue, priority, and confirmation.
