# Testing json-render App with MCP Server

This guide walks you through testing the newly built v1.0 json-render component library with the MCP server.

## What You'll Test

The **json-render-cdn.html** app provides:
- Natural language UI generation interface
- Real-time streaming of AI-generated component specs
- Catalog of 8 SurfacesUI components (primitives, molecules, organism)
- Live rendering of generated UIs with full theming support
- MCP Bridge integration for action system

## Quick Start

### 1. Configure AWS Bedrock Access

The server uses AWS Bedrock with Claude Sonnet 4.5. Make sure you have AWS credentials configured:

**Option A: AWS SSO (Recommended)**
```bash
aws sso login
```

**Option B: IAM Access Keys**
```bash
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

The `.env` file is already configured for Bedrock:
```bash
LLM_PROVIDER=bedrock
AWS_REGION=us-east-1
```

**Note**: If you prefer to use Anthropic API instead, change in `server/.env`:
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 2. Start the Server

```bash
cd server
./test_json_render.sh
```

The server will start on http://localhost:3000

### 3. Open the App

Navigate to: **http://localhost:3000/json-render-cdn**

You should see the NLGenerator interface with:
- Prompt input field
- Example prompt buttons
- Theme toggle (light/dark)
- Density selector (compact/comfortable/spacious)

## Testing Scenarios

### Test 1: Basic UI Generation

1. Click an example prompt button (e.g., "Show SQL results as table with charts")
2. Watch the streaming progress indicator
3. Verify the generated UI renders correctly
4. Check that components match the expected catalog types

**Expected Result**:
- Streaming progress shows compilation steps
- Generated spec appears in the UI
- Components render with proper styling
- Theme and density settings apply correctly

### Test 2: Custom Prompts

Try these natural language prompts:

```
Show a data table with sortable columns
```

```
Create a bar chart comparing sales by region
```

```
Display SQL results with filtering and chart visualization
```

**Expected Result**: AI generates valid JSON specs matching the catalog schema

### Test 3: Theme Switching

1. Generate a UI component
2. Toggle between light and dark themes
3. Verify colors invert correctly
4. Check that there's no flash of unstyled content (FOUC)

**Expected Result**:
- Instant theme switching without page reload
- Background and foreground colors swap
- All components inherit theme correctly

### Test 4: Density Variants

1. Generate a UI component
2. Switch between compact/comfortable/spacious
3. Verify spacing scales appropriately

**Expected Result**:
- Compact: 0.8x spacing scale
- Comfortable: 1.0x spacing scale (default)
- Spacious: 1.2x spacing scale

### Test 5: Invalid Spec Handling

1. Enter a prompt that doesn't match the catalog: "Create a video player"
2. Verify graceful error handling

**Expected Result**:
- Validation catches unsupported component types
- Clear error message displayed
- No app crash or broken state

## Verification Checklist

After testing, verify these v1.0 accomplishments:

- [ ] **NL Generation**: Natural language prompts generate valid specs
- [ ] **Streaming**: Progressive UI updates during generation
- [ ] **Catalog**: All 8 components accessible (DataTable, Chart, Filter, DensityToggle, ViewModeToggle, TableWithFilters, ChartWithControls, SQLResultsDisplay)
- [ ] **Rendering**: Generated specs render to working React UIs
- [ ] **Theming**: Light/dark theme switching works
- [ ] **Density**: Compact/comfortable/spacious modes work
- [ ] **Performance**: No lag or jank during generation/rendering
- [ ] **Bundle Size**: Single-file HTML loads quickly (591KB gzipped)
- [ ] **Accessibility**: Keyboard navigation works, screen readers supported

## Architecture

```
┌─────────────────────────────────────────┐
│  Browser: http://localhost:3000/json-render-cdn
│  ┌─────────────────────────────────┐
│  │  NLGenerator Component          │
│  │  • Prompt input                 │
│  │  • Example buttons              │
│  │  • Streaming progress           │
│  └──────────┬──────────────────────┘
│             │ calls
│  ┌──────────▼──────────────────────┐
│  │  McpAppsBridge (postMessage)    │
│  └──────────┬──────────────────────┘
└─────────────┼──────────────────────────┘
              │
┌─────────────▼──────────────────────────┐
│  MCP Server (Python FastMCP)           │
│  ┌─────────────────────────────────┐   │
│  │  generate_ui tool               │   │
│  │  • Catalog prompt generation    │   │
│  │  • Anthropic Claude 4.5         │   │
│  │  • Structured output (JSON)     │   │
│  │  • Streaming compilation        │   │
│  └─────────────────────────────────┘   │
└────────────────────────────────────────┘
```

## Troubleshooting

### Issue: "AWS credentials not found"

**Solution**: Login with AWS SSO:
```bash
aws sso login
```

Or set IAM credentials:
```bash
export AWS_ACCESS_KEY_ID=your-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-key
```

Verify credentials work:
```bash
aws sts get-caller-identity
```

### Issue: "Bedrock model not available in region"

**Solution**: Change region in `server/.env`:
```bash
AWS_REGION=us-west-2  # or your preferred region with Claude Sonnet 4.5
```

Check model availability: https://docs.aws.amazon.com/bedrock/latest/userguide/models-regions.html

### Issue: "App not found: json-render-cdn"

**Solution**: Build the apps bundle:
```bash
cd packages/components
pnpm build:apps
```

### Issue: "Port 3000 already in use"

**Solution**: Kill the process or change the port:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in .env
HTTP_PORT=3001
```

### Issue: Generated UIs not styling correctly

**Solution**: Hard refresh the browser (Cmd+Shift+R or Ctrl+Shift+R) to clear cache.

### Issue: Streaming doesn't work

**Cause**: The single-file bundle uses McpAppsBridge which expects postMessage communication.

**Solution**: This is expected in HTTP-only mode. For full streaming, configure Claude Desktop with the MCP server (see Claude Desktop Configuration below).

## Claude Desktop Configuration (Optional)

To use the app in Claude Desktop with full MCP integration:

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "surfacesui": {
      "command": "/Users/josh.schoen/repos/surfacesui/server/venv/bin/python",
      "args": ["-m", "src.main"],
      "cwd": "/Users/josh.schoen/repos/surfacesui/server",
      "env": {
        "HTTP_ONLY": "false",
        "MOCK_MODE": "true",
        "HTTP_PORT": "3000",
        "LLM_PROVIDER": "bedrock",
        "AWS_REGION": "us-east-1"
      }
    }
  }
}
```

**Note**: Claude Desktop will use your system's AWS credentials (SSO or environment variables).

If you prefer Anthropic API, change env to:
```json
"env": {
  "LLM_PROVIDER": "anthropic",
  "ANTHROPIC_API_KEY": "sk-ant-your-key-here"
}
```

Then restart Claude Desktop. The json-render app will be available as an MCP resource: `ui://json-render-cdn`

## What's Next?

After validating v1.0, consider:

1. **Performance Testing**: Test with 100K+ row datasets using DataTable
2. **Browser Compatibility**: Test in Chrome, Firefox, Safari, Edge
3. **Mobile Testing**: Test responsive layouts on mobile devices
4. **Integration Testing**: Integrate with existing web applications
5. **Production Deployment**: Deploy to production MCP Apps environment

## Documentation

For detailed API documentation:
- **Catalog API**: `packages/components/docs/CATALOG_API.md`
- **Integration Guide**: `packages/components/docs/INTEGRATION_GUIDE.md`
- **Registry Extension**: `packages/components/docs/REGISTRY_EXTENSION.md`

## v1.0 Milestone Stats

- **9 phases** completed (Feb 10-18, 2026)
- **34 plans** executed
- **180 tests** passing (100% pass rate, zero accessibility violations)
- **1,991 lines** of documentation
- **591KB** gzipped production bundle
- **8 catalogable components** (all under 400 lines)

Congratulations on completing the v1.0 milestone! 🎉
