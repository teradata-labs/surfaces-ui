#!/bin/bash
# Test script for json-render app with Node.js AI server

echo "=== SurfacesUI json-render Test ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Creating default..."
    cat > .env << 'EOF'
# AI Provider Configuration
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
PORT=3457
EOF
    echo "✓ Created .env with Bedrock defaults"
fi

# Check provider configuration
AI_PROVIDER=$(grep "^AI_PROVIDER=" .env | cut -d '=' -f2)

if [ "$AI_PROVIDER" = "bedrock" ]; then
    echo "✓ Using AWS Bedrock (Claude Sonnet 4.5)"
    echo "  Checking AWS credentials..."

    if aws sts get-caller-identity &>/dev/null; then
        IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo "Unknown")
        echo "  ✓ AWS credentials valid: $IDENTITY"
    else
        echo "  ❌ AWS credentials not found"
        echo "     Please run: aws sso login"
        echo ""
        exit 1
    fi
elif [ "$AI_PROVIDER" = "anthropic" ]; then
    echo "✓ Using Anthropic API"
    if ! grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
        echo "  ❌ ANTHROPIC_API_KEY not configured in .env"
        exit 1
    fi
fi

# Check if apps are built
BUNDLE="packages/mcp-adapter/apps/json-render-cdn.html"
if [ ! -f "$BUNDLE" ]; then
    echo "❌ Apps not built. Building..."
    pnpm build:apps
fi

BUNDLE_SIZE=$(du -h "$BUNDLE" | cut -f1)
echo "✓ json-render bundle ready ($BUNDLE_SIZE)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    pnpm install
fi

# Start server
PORT=$(grep "^PORT=" .env | cut -d '=' -f2)
PORT=${PORT:-3457}

echo "Starting AI server on http://localhost:$PORT..."
echo ""
echo "Open in browser:"
echo "  → http://localhost:$PORT/json-render"
echo ""
echo "Press Ctrl+C to stop"
echo ""

node ai-api-server.mjs
