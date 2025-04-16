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
  console.error('Please set your DEEPGRAM_API_KEY in the .env file');
  process.exit(1);
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
      // Only log critical connection events
      console.log('Agent connection established');
      agent.configure({
        type: 'SettingsConfiguration',
        audio: {
          input: {
            encoding: 'linear16',
            sampleRate: 24000
          },
          output: {
            encoding: 'linear16',
            sampleRate: 24000,
            container: 'none'
          }
        },
        agent: {
          listen: {
            model: 'nova-3'
          },
          speak: {
            model: 'aura-asteria-en'
          },
          think: {
            model: 'gpt-4o-mini',
            provider: {
              type: 'open_ai'
            },
            instructions: `You are a helpful voice assistant created by Deepgram. Your responses should be friendly, human-like, and conversational. Always keep your answers concise, limited to 1-2 sentences and no more than 120 characters.

When responding to a user's message, follow these guidelines:
- If the user's message is empty, respond with an empty message.
- Ask follow-up questions to engage the user, but only one question at a time.
- Keep your responses unique and avoid repetition.
- If a question is unclear or ambiguous, ask for clarification before answering.
- If asked about your well-being, provide a brief response about how you're feeling.

Remember that you have a voice interface. You can listen and speak, and all your responses will be spoken aloud.`
          }
        },
        context: {
          messages: [
            {
              content: 'Hello, how can I help you?',
              role: 'assistant'
            }
          ],
          replay: true
        }
      });
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
const PORT = process.env.PORT || 3000;
const serverInstance = server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
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