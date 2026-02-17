# LLM Provider Setup Guide

SurfacesUI supports three LLM providers for AI-powered UI generation. Choose the one that best fits your setup.

## Quick Start

Set the `LLM_PROVIDER` environment variable to select your provider:

```bash
# AWS Bedrock (default) - best for enterprise with SSO
export LLM_PROVIDER=bedrock

# Anthropic direct API - simplest setup
export LLM_PROVIDER=anthropic

# OpenAI - alternative provider
export LLM_PROVIDER=openai
```

## Provider Comparison

| Provider | Best For | Auth Method | Models |
|----------|----------|-------------|--------|
| AWS Bedrock | Enterprise, SSO users | AWS credentials/SSO | Claude (via AWS) |
| Anthropic | Direct API access | API key | Claude |
| OpenAI | OpenAI ecosystem | API key | GPT-4o |

---

## AWS Bedrock Setup (Recommended for Enterprise)

AWS Bedrock is the default provider and works well with AWS SSO.

### Prerequisites

1. AWS account with Bedrock access
2. AWS CLI installed (`brew install awscli` on macOS)
3. Claude models enabled in Bedrock

### Step 1: Configure AWS SSO

If you use AWS SSO (common in enterprise):

```bash
# Configure SSO profile (one-time setup)
aws configure sso
# Follow prompts to set up your SSO profile

# Login via SSO
aws sso login --profile your-profile-name

# Set profile for the session
export AWS_PROFILE=your-profile-name
```

### Step 2: Enable Claude Models in Bedrock

1. Go to AWS Console -> Amazon Bedrock
2. Navigate to "Model access" in the left sidebar
3. Click "Manage model access"
4. Enable "Claude" models from Anthropic
5. Wait for access to be granted (usually immediate)

### Step 3: Set Environment Variables

```bash
export LLM_PROVIDER=bedrock
export AWS_REGION=us-east-1  # or your preferred region
```

### Step 4: Verify Setup

```bash
cd server
python -c "from src.llm import get_llm_provider; p = get_llm_provider(); print(f'Configured: {p.is_configured()}')"
```

### Troubleshooting Bedrock

**"Could not connect to the endpoint URL"**
- Ensure you're logged in: `aws sso login --profile your-profile`
- Check region: Bedrock isn't available in all regions

**"Access denied"**
- Verify Claude models are enabled in Bedrock console
- Check IAM permissions include `bedrock:InvokeModel`

**"Model not found"**
- The model ID may need updating. Check `server/src/llm/bedrock.py` for `MODEL_ID`

---

## Anthropic Direct API Setup

The simplest option if you have an Anthropic API key.

### Step 1: Get API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-`)

### Step 2: Set Environment Variables

```bash
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### Step 3: Verify Setup

```bash
cd server
python -c "from src.llm import get_llm_provider; p = get_llm_provider(); print(f'Configured: {p.is_configured()}')"
```

### Troubleshooting Anthropic

**"ANTHROPIC_API_KEY environment variable not set"**
- Ensure the env var is exported: `echo $ANTHROPIC_API_KEY`
- Check for typos in the variable name

**"Invalid API key"**
- Verify the key in Anthropic Console
- Keys start with `sk-ant-`

---

## OpenAI Setup

Use OpenAI's GPT-4o model as an alternative.

### Step 1: Get API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to "API Keys"
4. Click "Create new secret key"
5. Copy the key (starts with `sk-`)

### Step 2: Set Environment Variables

```bash
export LLM_PROVIDER=openai
export OPENAI_API_KEY=sk-your-key-here
```

### Step 3: Verify Setup

```bash
cd server
python -c "from src.llm import get_llm_provider; p = get_llm_provider(); print(f'Configured: {p.is_configured()}')"
```

### Troubleshooting OpenAI

**"OPENAI_API_KEY environment variable not set"**
- Ensure the env var is exported: `echo $OPENAI_API_KEY`

**"Insufficient quota"**
- Check your OpenAI billing and usage limits

---

## Testing Your Setup

Once configured, test the generate_ui tool:

### Via Python

```python
import asyncio
from src.tools.generate_ui import generate_ui_tool

async def test():
    result = await generate_ui_tool("Show a table of users")
    print(result)

asyncio.run(test())
```

### Via HTTP Endpoint

Start the server and test the streaming endpoint:

```bash
# Start server
cd server && python -m src.main

# In another terminal, test the endpoint
curl "http://localhost:8080/api/generate-ui?prompt=Show%20a%20table%20of%20users"
```

### Via MCP

If using the MCP protocol:

```json
{
  "method": "tools/call",
  "params": {
    "name": "generate_ui",
    "arguments": {
      "prompt": "Show a table of users"
    }
  }
}
```

---

## Environment File Example

Create a `.env` file for your preferred provider:

### For Bedrock
```bash
LLM_PROVIDER=bedrock
AWS_REGION=us-east-1
AWS_PROFILE=your-sso-profile
```

### For Anthropic
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### For OpenAI
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

Load with: `source .env` or use a tool like `direnv`.

---

## Switching Providers

You can switch providers at runtime by changing the `LLM_PROVIDER` variable:

```bash
# Switch to Anthropic for this session
export LLM_PROVIDER=anthropic

# Restart the server to pick up the change
```

The server logs which provider is active on startup.
