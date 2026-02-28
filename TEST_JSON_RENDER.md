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
# From project root
./test_json_render.sh
```

The server will start on http://localhost:3457

### 3. Open the App

Navigate to: **http://localhost:3457/json-render**

You should see the NLGenerator interface with:
- Prompt input field
- Example prompt buttons
- Theme toggle (light/dark)
- Density selector (compact/comfortable/spacious)

## Quick Testing

Try these prompts to verify everything works:

### Example Prompts

**Tables:**
- `show me a table with filters` → TableWithFilters with 50 rows of sample data
- `filterable table of employees` → TableWithFilters with search capability
- `compact table with all data` → Table with compact density (tighter spacing)
- `show a table with only id, name, and price columns` → Custom column selection

**Charts:**
- `create a bar chart comparing revenue by region` → Bar chart with regional data
- `show monthly sales as a line chart` → Line chart with time series
- `chart with axis configuration controls` → ChartWithControls with dropdowns

**Complete Interfaces:**
- `full SQL results with table and chart views` → SQLResultsDisplay organism
- `show me both a data table and a chart side by side` → Multiple components

**What You Should See:**
- ✓ 50 rows of sample data with realistic values
- ✓ Columns: id, name, category, price, quantity, revenue, region, status, date
- ✓ Interactive filters that search across all fields
- ✓ Charts with hover tooltips and legends
- ✓ Smooth transitions and animations

## Comprehensive Testing

For detailed test scenarios with expected results and verification steps, see:

**[TESTING_GUIDE.md](./TESTING_GUIDE.md)**

Includes:
- 10 comprehensive test scenarios
- Theme and density testing
- Error handling verification
- Performance benchmarks
- Accessibility testing
- Regression checklist


## Architecture

```
┌─────────────────────────────────────────┐
│  Browser: http://localhost:3457/json-render
│  ┌─────────────────────────────────┐
│  │  NLGenerator Component          │
│  │  • Prompt input                 │
│  │  • Example buttons              │
│  │  • Streaming progress           │
│  └──────────┬──────────────────────┘
│             │ calls
│  ┌──────────▼──────────────────────┐
│  │  /api/generate-ui endpoint      │
│  └──────────┬──────────────────────┘
└─────────────┼──────────────────────────┘
              │
┌─────────────▼──────────────────────────┐
│  Node.js AI Server (ai-api-server.mjs) │
│  ┌─────────────────────────────────┐   │
│  │  Multi-Provider AI Backend      │   │
│  │  • AWS Bedrock (default)        │   │
│  │  • Anthropic API                │   │
│  │  • OpenAI API                   │   │
│  │  • Google Gemini                │   │
│  │  • Streaming JSON specs         │   │
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
    "surfaces-ui": {
      "command": "node",
      "args": ["/absolute/path/to/surfaces-ui/packages/server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

Then restart Claude Desktop. The json-render and sql-editor apps will be available as MCP resources:
- `ui://json-render-cdn`
- `ui://sql-editor-cdn`

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
