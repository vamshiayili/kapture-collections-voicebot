require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function createAgent() {
  const secretToken = process.env.VAPI_SECRET_TOKEN || process.argv[2];
  const webhookUrl = process.env.VAPI_SECRET_TOKEN ? (process.argv[2] || process.env.WEBHOOK_URL) : (process.argv[3] || process.env.WEBHOOK_URL);

  if (!secretToken || !webhookUrl) {
    console.log('\n================================================================');
    console.log('⚠️  Usage Parameter Missing!');
    console.log('================================================================');
    console.log('Usage:');
    console.log('  node create-agent.js <VAPI_SECRET_TOKEN> <WEBHOOK_URL>');
    console.log('\nExample:');
    console.log('  node create-agent.js vapi_sec_123abc https://xxxx.ngrok-free.app/webhook');
    console.log('================================================================\n');
    process.exit(1);
  }

  console.log('Reading system prompt and tool definitions...');
  const promptPath = path.join(__dirname, '..', 'vapi', 'system_prompt.txt');
  const toolsPath = path.join(__dirname, '..', 'vapi', 'tool_definitions.json');

  let systemPrompt, tools;
  try {
    systemPrompt = fs.readFileSync(promptPath, 'utf8');
    const toolsRaw = fs.readFileSync(toolsPath, 'utf8');
    tools = JSON.parse(toolsRaw);
  } catch (err) {
    console.error('Failed to read config files:', err.message);
    process.exit(1);
  }

  // Attach server webhook URL to all tools
  const mappedTools = tools.map(tool => {
    return {
      ...tool,
      server: {
        url: webhookUrl
      }
    };
  });

  const payload = {
    name: "Maya - Kapture Collections Agent",
    firstMessage: "Hello, this is Maya calling from Kapture Finance. Am I speaking with Rahul Sharma?",
    transcriber: {
      provider: "deepgram",
      model: "nova-2",
      language: "en"
    },
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      tools: mappedTools
    },
    voice: {
      provider: "vapi",
      voiceId: "Emma"
    }
  };

  console.log('Registering AI Agent on Vapi Server...');
  try {
    const response = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vapi API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('\n================================================================');
    console.log('🚀 AI Voice Agent successfully created on Vapi!');
    console.log('================================================================');
    console.log(`Assistant Name: ${data.name}`);
    console.log(`Assistant ID:   ${data.id}`);
    console.log('================================================================');
    console.log('\nHow to test:');
    console.log('1. Open your web browser to http://localhost:3000.');
    console.log('2. Navigate to the "Vapi Agent Studio" tab.');
    console.log('3. Input this Assistant ID into the Vapi Assistant ID field.');
    console.log('4. Click the green "Talk" button to start voice testing Maya!');
    console.log('================================================================\n');
  } catch (err) {
    console.error('Failed to create assistant:', err.message);
  }
}

createAgent();
