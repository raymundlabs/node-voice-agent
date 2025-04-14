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
      console.log('Connection opened');
      // Configure the agent once connection is established
      agent.configure({
        type: 'SettingsConfiguration',
        audio: {
          input: {
            encoding: 'linear16',
            sampleRate: 48000
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
      console.log('Agent started speaking:', data.total_latency);
    });

    agent.on(AgentEvents.ConversationText, (message: { role: string; content: string }) => {
      console.log(`${message.role} said: ${message.content}`);
    });

    agent.on(AgentEvents.Audio, (audio: Buffer) => {
      // Forward the agent's audio response to the browser client
      if (browserWs && browserWs.readyState === WebSocket.OPEN) {
        browserWs.send(audio);
      }
    });

    agent.on(AgentEvents.Error, (error: Error) => {
      console.error('Error:', error);
    });

    agent.on(AgentEvents.Close, () => {
      console.log('Connection closed');
      // Clean up browser connection if it exists
      if (browserWs && browserWs.readyState === WebSocket.OPEN) {
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
  console.log('Browser client connected');
  browserWs = ws;

  const agent = await connectToAgent();

  // Send audio data from browser to agent
  ws.on('message', (data: Buffer) => {
    try {
      if (agent) {
        agent.send(data);
        console.log('Sent audio data to agent');
      }
    } catch (error) {
      console.error('Error sending audio data:', error);
    }
  });

  ws.on('close', () => {
    console.log('Browser client disconnected');
    browserWs = null;
    // Close the agent connection
    if (agent) {
      agent.disconnect();
    }
  });

  // Handle browser WebSocket errors
  ws.on('error', (error) => {
    console.error('Browser WebSocket error:', error);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});