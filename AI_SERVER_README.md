# Multi-Provider AI API Server

A flexible backend server for testing the json-render UI generator with multiple AI providers.

## Supported Providers

| Provider | Models | Requirements |
|----------|--------|--------------|
| **AWS Bedrock** | Claude 3.5 Sonnet, Claude 3 | AWS credentials with Bedrock access |
| **Anthropic API** | Claude 3.5 Sonnet, Claude 3 Opus | Anthropic API key |
| **OpenAI** | GPT-4o, GPT-4 Turbo, GPT-4 | OpenAI API key |
| **Google Gemini** | Gemini 2.0 Flash, Gemini Pro | Google AI API key |

## Quick Start

### 1. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` to set your provider and credentials:

```bash
# Choose provider: bedrock, anthropic, openai, gemini
AI_PROVIDER=bedrock

# Set appropriate credentials for your chosen provider
ANTHROPIC_API_KEY=your-key-here
# or
OPENAI_API_KEY=your-key-here
# or
GEMINI_API_KEY=your-key-here
```

### 2. Start the Server

```bash
node ai-api-server.mjs
```

### 3. Test the UI Generator

Open your browser:
```
http://localhost:3457/json-render
```

## Provider Configuration

### AWS Bedrock

Uses your AWS credentials from environment or `~/.aws/credentials`.

```bash
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

**Requirements:**
- AWS CLI configured with credentials
- Bedrock access enabled in your AWS account
- Access to Claude models in Bedrock

### Anthropic API

Direct Claude API access (no AWS required).

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**Get API Key:** https://console.anthropic.com/

**Available Models:**
- `claude-3-5-sonnet-20241022` (recommended)
- `claude-3-opus-20240229`
- `claude-3-haiku-20240307`

### OpenAI

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_MODEL=gpt-4o
```

**Get API Key:** https://platform.openai.com/api-keys

**Available Models:**
- `gpt-4o` (recommended)
- `gpt-4-turbo`
- `gpt-4`

### Google Gemini

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=xxx
GEMINI_MODEL=gemini-2.0-flash-exp
```

**Get API Key:** https://makersuite.google.com/app/apikey

**Available Models:**
- `gemini-2.0-flash-exp` (recommended, fastest)
- `gemini-pro`

## How It Works

1. **Frontend** sends natural language prompt to `/api/generate-ui`
2. **Server** calls chosen AI provider with system prompt
3. **AI** generates SurfacesUI component specification
4. **Server** streams response back to frontend
5. **Frontend** validates and renders the component

## Example Prompts

Try these prompts in the UI:

- **"Show a filterable table with employee data"**
- **"Display sales by region as a bar chart"**
- **"Create a pie chart showing product categories"**
- **"Show SQL results with both table and chart views"**
- **"Build a data table with search and density controls"**

## API Endpoint

### `GET /api/generate-ui`

**Query Parameters:**
- `prompt` (required) - Natural language description of UI component
- `explain` (optional) - Set to `true` to include explanation

**Response:** NDJSON stream

```json
{"chunk":"{\n  \"root"}
{"chunk":"\": \"table\"}
{"spec":{"root":"table","elements":{...}}}
```

## Testing Different Providers

Switch providers by changing `AI_PROVIDER` in `.env` and restarting:

```bash
# Test with Anthropic
echo "AI_PROVIDER=anthropic" > .env
echo "ANTHROPIC_API_KEY=your-key" >> .env
node ai-api-server.mjs

# Test with OpenAI
echo "AI_PROVIDER=openai" > .env
echo "OPENAI_API_KEY=your-key" >> .env
node ai-api-server.mjs
```

## Troubleshooting

### AWS Bedrock: "Invocation not supported"

Update model ID to use inference profile:
```bash
BEDROCK_MODEL=us.anthropic.claude-3-5-sonnet-20241022-v2:0
```

### Anthropic/OpenAI: "Invalid API key"

Verify your API key is correct and has credits.

### Gemini: "API key not valid"

Enable the Generative Language API in Google Cloud Console.

### All Providers: No response

Check server logs for errors:
```bash
tail -f /private/tmp/claude/.../tasks/[task-id].output
```

## Development

The server automatically:
- ✅ Parses JSON specs from AI responses
- ✅ Handles streaming for real-time updates
- ✅ Validates SurfacesUI spec format
- ✅ Provides CORS headers for local development
- ✅ Serves the json-render HTML app

## Production Use

For production, this server pattern can be integrated into:
- **Claude Desktop** - Specs provided via MCP bridge
- **Vantage MCP Server** - Backend generates specs for Teradata users
- **Custom Backends** - Any system that needs AI-generated UIs

The json-render app is designed to work with or without this backend.
