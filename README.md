# Maya Outbound Collections Voicebot ("kapture-collections-voicebot")

Maya is an empathetic, compliant, and state-enforced Voice AI Collections Specialist built for **Kapture Finance**. Using a combination of real-time Speech-to-Text (Deepgram), Large Language Models (OpenAI GPT-4o-mini), and Text-to-Speech (Cartesia/ElevenLabs), Maya automates outbound payment reminders, securely verifies customer identities, logs Promises to Pay (PTP), dispatches digital checkout links, and routes financial hardship or disputes to live collections specialists.

Maya is built on the **Vapi.ai** voicebot orchestration platform, integrating with a custom Express.js webhook backend to handle business logic and CRM state updates.

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [ngrok](https://ngrok.com/) (to tunnel your local webhook server to Vapi)
* A [Vapi.ai](https://vapi.ai/) developer account

---

## 🛠️ Step-by-Step Local Setup

### Step 1: Install Server Dependencies
Clone the repository, navigate into the `mock-server` folder, and install the required dependencies:
```bash
cd mock-server
npm install
```

### Step 2: Configure Environment Variables
Copy the env template file to configure local parameters:
```bash
cp .env.example .env
```
*(By default, the server runs on port 3000)*

### Step 3: Start the Webhook Server
Run the Express server locally:
```bash
npm start
```
Upon startup, the server output will display:
```text
================================================================
 Maya Collections Voicebot Mock Webhook Server Running
 Port: 3000
 Webhook URL: http://localhost:3000/webhook
 Health Check: http://localhost:3000/health
================================================================
```

### Step 4: Run Automated Webhook Tests
Verify that all 5 webhook integrations function correctly by running the integration test runner:
```bash
node ../tests/test_server.js
```
This script loads test cases from `tests/test_cases.json` and asserts response structures against expected properties. All tests should report `✅ Passed!`.

---

## 🌐 Connecting to Vapi via ngrok

To register your local server with the Vapi.ai platform, you must expose port 3000 to the public internet using ngrok.

### Step 1: Fire up the ngrok Tunnel
In a new terminal window, start ngrok pointing to port 3000:
```bash
ngrok http 3000
```

### Step 2: Copy the Public HTTPS URL
ngrok will generate a unique forwarding URL (e.g., `https://xxxx-xx-xx-xx.ngrok-free.app`). Copy this URL. Your Vapi webhook route will be:
```text
https://xxxx-xx-xx-xx.ngrok-free.app/webhook
```

### Step 3: Register Tools on Vapi.ai Dashboard
1. Log in to the [Vapi Dashboard](https://dashboard.vapi.ai/).
2. Navigate to the **Tools** tab and register each tool defined in [`vapi/tool_definitions.json`](file:///c:/Users/saite/OneDrive/Desktop/kapture-collections-voicebot/vapi/tool_definitions.json).
3. Set the **Server URL** for each tool to your ngrok webhook address: `https://xxxx-xx-xx-xx.ngrok-free.app/webhook`.

### Step 4: Configure Assistant
1. Create a **Blank Template** assistant named **Maya**.
2. Under the **Model** settings, select **GPT-4o-mini**, set the **Temperature** to `0.1`, and copy-paste the system prompt from [`vapi/system_prompt.txt`](file:///c:/Users/saite/OneDrive/Desktop/kapture-collections-voicebot/vapi/system_prompt.txt).
3. Bind the registered tools to the assistant.
4. Under **Transcriber**, select **Deepgram Nova-2** (en-US or multi-language). Under **Voice**, select **Cartesia** or **ElevenLabs** (e.g., ElevenLabs Rachel/Sarah).
5. Trigger an outbound call via Web Call or WebRTC simulator to test!

---

## 🏗️ System Architecture & Data Flow

Maya's architecture is structured across 4 layers to isolate speech streaming from business logic and database updates:

```
                  ┌──────────────────────────────────────────────┐
                  │          Customer Telephony (SIP/PSTN)       │
                  └──────────────────────┬───────────────────────┘
                                         │ Full-Duplex Audio stream
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │                 Vapi Voice AI                │
                  │  ┌──────────────┐ ┌───────────┐ ┌─────────┐  │
                  │  │Deepgram Nova2│ │GPT-4o-mini│ │Cartesia │  │
                  │  │    (STT)     │ │   (LLM)   │ │  (TTS)  │  │
                  │  └──────────────┘ └─────┬─────┘ └─────────┘  │
                  └─────────────────────────┼────────────────────┘
                                            │ HTTP POST (JSON Payload)
                                            ▼
                  ┌──────────────────────────────────────────────┐
                  │            Mock Integration Server           │
                  │  ┌────────────────────────────────────────┐  │
                  │  │           Webhook API Router           │  │
                  │  └──────────────────┬─────────────────────┘  │
                  │                     │                        │
                  │      ┌──────────────┼──────────────┐         │
                  │      ▼              ▼              ▼         │
                  │ ┌──────────┐   ┌──────────┐   ┌──────────┐   │
                  │ │Customer  │   │Promise to│   │Payment   │   │
                  │ │Verify    │   │Pay Ledger│   │Link Disp │   │
                  │ └──────────┘   └──────────┘   └──────────┘   │
                  └─────────────────────┬────────────────────────┘
                                        │ CRM outcome updates
                                        ▼
                  ┌──────────────────────────────────────────────┐
                  │          Enterprise LMS & Kapture CRM        │
                  └──────────────────────────────────────────────┘
```

### Architectural Layer Responsibilities
1. **Speech Processing & Streaming**: Vapi handles speech-to-text (Deepgram) and text-to-speech (Cartesia/ElevenLabs) synthesis, utilizing Voice Activity Detection (VAD) to allow natural customer interruptions.
2. **Cognitive Orchestration (LLM)**: GPT-4o-mini acts as the brain. Gated by a state machine prompt, the LLM processes conversational inputs, enforces RBI compliance, and decides when to trigger tool calls.
3. **Integration Webhook (Express.js)**: Receives tool-call HTTP POST requests, validates schemas, runs local logic, logs tool outcomes, and updates the CRM state.
4. **CRM & Ledger Sync**: Writes permanent call records, DNC opt-outs, and scheduled Promise-to-Pay agreements to the collections database.

---

## ⚠️ Limitations & Future Enhancements

### Known Limitations
* **Stateless Backend Mock**: The mock database store in `server.js` resets on server restart. In production, this must connect to a persistent Postgres/MongoDB layer.
* **Browser Speech Synthesis (Call Simulator)**: The frontend local call simulator relies on browser `window.speechSynthesis`. Browser speech synthesis engines differ across devices and may experience voice loading latencies. A cloud TTS proxy backup is implemented in `/api/tts` using Google TTS to mitigate this.
* **Fixed DPD Calculation**: Overdue days past due are relative to a fixed timestamp in the mock database (August 3rd, 2026). Real deployments should pull relative DPD calculations from active Loan Management System (LMS) dates.

### Future Improvements
1. **Telephony Failover**: Set up fallback Twilio SIP routes to automatically switch carriers if latency spikes above 200ms on the primary trunk.
2. **Real-time Sentiment-based De-escalation**: Feed live STT transcription sentiment values into the LLM context to prompt immediate supervisor transfers if customer stress or aggression scores increase.
3. **Digital Signature Contracts**: Connect the `log_promise_to_pay` webhook to a service like DocuSign/SignEasy to auto-dispatch legal payment extensions for customer signature via SMS.
4. **Secure OAuth2 Handshake**: Secure the webhook route by validating Vapi custom header signatures using JWT verification keys on all POST requests.
