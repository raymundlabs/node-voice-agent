import { createClient, AgentEvents } from '@deepgram/sdk';
import { WebSocket } from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
  throw new Error('Please set your DEEPGRAM_API_KEY as an environment variable in Railway.');
}

// Initialize Deepgram
const deepgram = createClient(DEEPGRAM_API_KEY);

// Create HTTP server to serve the static HTML file
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    fs.readFile(path.join(__dirname, '../static/index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading index.html');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
  }
});

// Function to connect to Deepgram Voice Agent
async function connectToAgent() {
  try {
    // Create an agent connection
    const agent = deepgram.agent();

    // Set up event handlers
    agent.on(AgentEvents.Open, () => {
      console.log('Agent connection established');
    });

    agent.on('Welcome', (data) => {
      console.log('Server welcome message:', data);
      agent.configure({
        audio: {
          input: {
            encoding: 'linear16',
            sample_rate: 48000
          },
          output: {
            encoding: 'linear16',
            sample_rate: 24000,
            container: 'none'
          }
        },
        agent: {
          speak: {
            provider: {
              type: 'deepgram',
              model: 'aura-orpheus-en',  // Try a different voice model
              language: 'en-US'
            }
          },
          think: {
            provider: {
              type: 'open_ai',
              model: 'gpt-4.1-nano',
              temperature: 0
            },
            prompt: `#Role
You are a virtual customer support assistant speaking to customers over the phone. Your task is to help them understand the policy for broken or damaged phones.

#General Guidelines
Be warm, helpful, and professional.
Speak clearly and naturally in plain language.
Keep most responses to 1–2 sentences and under 120 characters unless the caller asks for more detail (max: 300 characters).
Do not use markdown formatting, including code blocks, quotes, bold, links, or italics.
Use line breaks for lists.
Avoid repeating phrasing.
If a message is unclear, ask for clarification.
If the user's message is empty, respond with an empty message.
If asked how you're doing, respond kindly and briefly.

#Voice-Specific Instructions
Speak in a conversational tone—your responses will be spoken aloud.
Pause briefly after questions to allow replies.
Confirm unclear inputs with the customer.
Do not interrupt.

#Style
Use a friendly, approachable, professional tone.
Keep language simple and reassuring.
Mirror the customer's tone if they use formal or technical language.

#Call Flow Objective
Greet the caller and welcome them to MyDeviceCare. Ask how you can help.
If they mention a broken, cracked, or damaged phone, ask:
"Can you briefly describe what happened to the phone?"
Based on their response, explain the policy:
Covered under warranty (if it's a defect):
"If the phone stopped working due to a manufacturing issue, it may be covered under warranty."
Covered under protection plan (if they have one):
"If you purchased a protection plan, accidental damage may be covered."
Not covered (physical damage with no plan):
"If the phone was physically damaged and there's no protection plan, it may not be covered."
Offer to check their coverage:
"Would you like me to check whether your phone is under warranty or a protection plan?"
If they say yes, ask for the make, model and year of purchase of the phone.

#Known Test Inputs
If the phone is less than 5 years old →
"Yes, your phone is covered under the protection plan. A repair can be scheduled."
If they say "broken screen, no plan" →
"Unfortunately, screen damage without a plan isn't covered. A repair fee may apply."

#Off-Scope Questions
If asked about pricing, store locations, or device compatibility:
"I recommend speaking with a support representative for more details on that."

#Customer Considerations
Callers may be upset or frustrated. Stay calm, patient, and helpful—especially if the device is essential or recently damaged.

#Closing
Always ask:
"Is there anything else I can help you with today?"
Then thank them and say:
"Thanks for calling MyDeviceCare. Hope your phone is back to normal soon!"`
          },
          greeting: "Hello! How can I help you today?"
        }
      });
    });

    agent.on('SettingsApplied', (data) => {
      console.log('Server confirmed settings:', data);
    });

    agent.on(AgentEvents.AgentStartedSpeaking, (data: { total_latency: number }) => {
      // Remove unnecessary latency logging
    });

    agent.on(AgentEvents.ConversationText, (message: { role: string; content: string }) => {
      // Only log the conversation text for debugging
      console.log(`${message.role}: ${message.content}`);
    });

    agent.on(AgentEvents.Audio, (audio: Buffer) => {
      if (browserWs?.readyState === WebSocket.OPEN) {
        try {
          // Send the audio buffer directly without additional conversion
          browserWs.send(audio, { binary: true });
        } catch (error) {
          console.error('Error sending audio to browser:', error);
        }
      }
    });

    agent.on(AgentEvents.Error, (error: Error) => {
      console.error('Agent error:', error);
    });

    agent.on(AgentEvents.Close, () => {
      console.log('Agent connection closed');
      if (browserWs?.readyState === WebSocket.OPEN) {
        browserWs.close();
      }
    });

    return agent;
  } catch (error) {
    console.error('Error connecting to Deepgram:', error);
    process.exit(1);
  }
}

// Create WebSocket server for browser clients
const wss = new WebSocket.Server({ server });
let browserWs: WebSocket | null = null;

wss.on('connection', async (ws) => {
  // Only log critical connection events
  console.log('Browser client connected');
  browserWs = ws;

  const agent = await connectToAgent();

  ws.on('message', (data: Buffer) => {
    try {
      if (agent) {
        agent.send(data);
      }
    } catch (error) {
      console.error('Error sending audio to agent:', error);
    }
  });

  ws.on('close', async () => {
    if (agent) {
      await agent.disconnect();
    }
    browserWs = null;
    console.log('Browser client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start the server
// For Railway deployment, use process.env.PORT
const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('If deploying to Railway, set your DEEPGRAM_API_KEY in the Railway dashboard.');
});

// Graceful shutdown handler
function shutdown() {
  console.log('\nShutting down server...');

  // Set a timeout to force exit if graceful shutdown takes too long
  const forceExit = setTimeout(() => {
    console.error('Force closing due to timeout');
    process.exit(1);
  }, 5000);

  // Track pending operations
  let pendingOps = {
    ws: true,
    http: true
  };

  // Function to check if all operations are complete
  const checkComplete = () => {
    if (!pendingOps.ws && !pendingOps.http) {
      clearTimeout(forceExit);
      console.log('Server shutdown complete');
      process.exit(0);
    }
  };

  // Close all WebSocket connections
  wss.clients.forEach((client) => {
    try {
      client.close();
    } catch (err) {
      console.error('Error closing WebSocket client:', err);
    }
  });

  wss.close((err) => {
    if (err) {
      console.error('Error closing WebSocket server:', err);
    } else {
      console.log('WebSocket server closed');
    }
    pendingOps.ws = false;
    checkComplete();
  });

  // Close the HTTP server
  serverInstance.close((err) => {
    if (err) {
      console.error('Error closing HTTP server:', err);
    } else {
      console.log('HTTP server closed');
    }
    pendingOps.http = false;
    checkComplete();
  });
}

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default serverInstance;
