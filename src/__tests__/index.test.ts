import { WebSocket } from 'ws';
import { createClient } from '@deepgram/sdk';
import * as http from 'http';

// Mock environment variables
process.env.DEEPGRAM_API_KEY = 'mock-api-key';
process.env.PORT = '3001';

// Mock Deepgram SDK
jest.mock('@deepgram/sdk', () => ({
  createClient: jest.fn(() => ({
    agent: jest.fn(() => ({
      on: jest.fn(),
      configure: jest.fn(),
      send: jest.fn(),
      disconnect: jest.fn()
    }))
  })),
  AgentEvents: {
    Open: 'open',
    Audio: 'audio',
    Error: 'error',
    Close: 'close',
    AgentStartedSpeaking: 'agentStartedSpeaking',
    ConversationText: 'conversationText'
  }
}));

describe('Voice Agent Server', () => {
  let server: http.Server;
  let wsClient: WebSocket;

  beforeAll(async () => {
    // Import the server after setting up mocks
    const { default: app } = await import('../index');
    server = app;
  });

  afterAll((done) => {
    // Create a promise that resolves when the WebSocket closes
    const closeWebSocket = new Promise<void>((resolve) => {
      if (wsClient && wsClient.readyState === WebSocket.OPEN) {
        // Wait for the close event which will happen after agent disconnect
        wsClient.on('close', () => {
          // Add a small delay to allow for cleanup logging
          setTimeout(resolve, 100);
        });
        wsClient.close();
      } else {
        resolve();
      }
    });

    // Wait for both WebSocket and server to close
    Promise.all([
      closeWebSocket,
      new Promise<void>((resolve) => server.close(() => {
        // Add a small delay to allow for cleanup logging
        setTimeout(resolve, 100);
      }))
    ]).then(() => done());
  });

  it('should start the server successfully', (done) => {
    const request = http.get(`http://localhost:${process.env.PORT}`, (response) => {
      expect(response.statusCode).toBe(200);
      done();
    });
    request.on('error', done);
  });

  it('should establish WebSocket connection', (done) => {
    wsClient = new WebSocket(`ws://localhost:${process.env.PORT}`);

    wsClient.on('open', () => {
      expect(wsClient.readyState).toBe(WebSocket.OPEN);
      done();
    });

    wsClient.on('error', done);
  });

  it('should create Deepgram agent when WebSocket connects', () => {
    expect(createClient).toHaveBeenCalledWith('mock-api-key');
  });

  it('should handle audio data from client', (done) => {
    const testData = Buffer.from('test audio data');

    wsClient.send(testData, (error) => {
      if (error) {
        done(error);
        return;
      }
      // We expect no errors when sending data
      done();
    });
  });
});