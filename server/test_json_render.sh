#!/bin/bash
# Test script for json-render app

echo "=== SurfacesUI json-render Test ==="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please create it first."
    exit 1
fi

# Check LLM provider configuration
LLM_PROVIDER=$(grep "^LLM_PROVIDER=" .env | cut -d '=' -f2)
if [ "$LLM_PROVIDER" = "bedrock" ]; then
    echo "✓ Using AWS Bedrock (Claude Sonnet 4.5)"
    echo "  Checking AWS credentials..."

    # Check if AWS credentials are available
    if aws sts get-caller-identity &>/dev/null; then
        IDENTITY=$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null || echo "Unknown")
        echo "  ✓ AWS credentials valid: $IDENTITY"
    else
        echo "  ⚠️  AWS credentials not found"
        echo "     Please login with: aws sso login"
        echo "     Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY"
        echo ""
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
elif [ "$LLM_PROVIDER" = "anthropic" ]; then
    echo "✓ Using Anthropic API"
    if ! grep -q "ANTHROPIC_API_KEY=sk-" .env 2>/dev/null; then
        echo "  ⚠️  ANTHROPIC_API_KEY not configured in .env"
        echo "     Please add your Anthropic API key to .env:"
        echo "     ANTHROPIC_API_KEY=sk-ant-..."
        echo ""
        read -p "Do you want to continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    echo "⚠️  Unknown LLM provider: $LLM_PROVIDER"
fi

# Check if venv exists
if [ ! -d venv ]; then
    echo "❌ Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check if json-render bundle exists
BUNDLE="../packages/components/dist/apps/json-render-cdn.html"
if [ ! -f "$BUNDLE" ]; then
    echo "❌ json-render bundle not found at: $BUNDLE"
    echo "   Building now..."
    cd ../packages/components
    pnpm build:apps
    cd ../../server
    echo "✓ Bundle built"
fi

# Get bundle size
BUNDLE_SIZE=$(du -h "$BUNDLE" | cut -f1)
echo "✓ json-render bundle ready ($BUNDLE_SIZE)"
echo ""

# Start server
echo "Starting server on http://localhost:3000..."
echo ""
echo "Available apps:"
echo "  • SQL Editor:     http://localhost:3000/sql-editor-cdn"
echo "  • JSON Render UI: http://localhost:3000/json-render-cdn"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python -m src.main
