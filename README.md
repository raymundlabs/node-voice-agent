# Node Voice Agent Starter

Start building interactive voice experiences with Deepgram's Voice Agent API using this Node.js starter application. This project demonstrates how to create a voice agent that can engage in natural conversations using Deepgram's advanced AI capabilities.

## What is Deepgram?

[Deepgram's](https://deepgram.com/) voice AI platform provides APIs for speech-to-text, text-to-speech, and full speech-to-speech voice agents. Over 200,000+ developers use Deepgram to build voice AI products and features.

## Prerequisites

Before you begin, ensure you have:
- Node.js 18 or higher installed
- npm (comes with Node.js)
- A Deepgram API key (see below)
- Audio files in supported formats (WAV, MP3, M4A, or FLAC)

## Quickstart

Follow these steps to get started with this starter application.

### Clone the repository

Go to GitHub and [clone the repository](https://github.com/deepgram-starters/node-voice-agent).

### Install dependencies

Install the project dependencies:

```bash
npm install
```

### Create a `.env` config file

Copy the code from `sample.env` and create a new file called `.env`. Paste in the code and enter your API key you generated in the [Deepgram Console](https://console.deepgram.com/).

```
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

### Run the application

Start the server with:

```bash
npm start
```

Then open your browser and go to:

```
http://localhost:3000
```

- Allow microphone access when prompted.
- Speak into your microphone to interact with the Deepgram Voice Agent.
- You should hear the agent's responses played back in your browser.

## Using Cursor & MDC Rules

This application can be modify as needed by using the [app-requirements.mdc](.cursor/rules/app-requirements.mdc) file. This file allows you to specify various settings and parameters for the application in a structured format that can be use along with [Cursor's](https://www.cursor.com/) AI Powered Code Editor.

### Using the `app-requirements.mdc` File

1. Clone or Fork this repo.
2. Modify the `app-requirements.mdc`
3. Add the necessary configuration settings in the file.
4. You can refer to the MDC file used to help build this starter application by reviewing  [app-requirements.mdc](.cursor/rules/app-requirements.mdc)


## Getting Help

- Join our [Discord community](https://discord.gg/deepgram) for support
- Found a bug? [Create an issue](https://github.com/deepgram-starters/node-voice-agent/issues)
- Have a feature request? [Submit it here](https://github.com/deepgram-starters/node-voice-agent/issues)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## Security

For security concerns, please review our [Security Policy](SECURITY.md).

## Code of Conduct

This project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

This project is licensed under the terms specified in [LICENSE](LICENSE).