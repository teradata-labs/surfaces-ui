#!/bin/bash
set -e

echo "================================"
echo "Pre-Merge Testing for PR #50"
echo "Branch: dependabot/github_actions/pnpm/action-setup-5.0.0"
echo "================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $1"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $1"
        ((FAILED++))
        return 1
    fi
}

echo "1️⃣  Testing lockfile integrity..."
pnpm install --frozen-lockfile > /dev/null 2>&1
test_result "pnpm install --frozen-lockfile"
echo ""

echo "2️⃣  Testing package builds..."
pnpm --filter @surfacesui/components build > /dev/null 2>&1
test_result "components package build"

pnpm --filter @surfacesui/mcp-adapter build > /dev/null 2>&1
test_result "mcp-adapter package build"

pnpm --filter @surfacesui/server build > /dev/null 2>&1
test_result "server package build"

pnpm --filter @surfacesui/app-framework build > /dev/null 2>&1
test_result "app-framework package build"
echo ""

echo "3️⃣  Testing HTML app bundles..."
if [ -f "packages/mcp-adapter/apps/sql-editor-cdn.html" ]; then
    SIZE=$(wc -c < packages/mcp-adapter/apps/sql-editor-cdn.html)
    if [ $SIZE -gt 100000 ]; then
        test_result "sql-editor-cdn.html exists and has content (${SIZE} bytes)"
    else
        echo -e "${RED}❌ FAIL${NC}: sql-editor-cdn.html too small"
        ((FAILED++))
    fi
else
    echo -e "${RED}❌ FAIL${NC}: sql-editor-cdn.html not found"
    ((FAILED++))
fi

if [ -f "packages/mcp-adapter/apps/json-render-cdn.html" ]; then
    test_result "json-render-cdn.html exists"
else
    echo -e "${RED}❌ FAIL${NC}: json-render-cdn.html not found"
    ((FAILED++))
fi

if [ -f "packages/mcp-adapter/apps/dashboard-viewer.html" ]; then
    test_result "dashboard-viewer.html exists"
else
    echo -e "${RED}❌ FAIL${NC}: dashboard-viewer.html not found"
    ((FAILED++))
fi
echo ""

echo "4️⃣  Testing CSS resources (from previous PR)..."
if [ -f "packages/mcp-adapter/apps/tokens.css" ]; then
    test_result "tokens.css exists"
else
    echo -e "${RED}❌ FAIL${NC}: tokens.css not found"
    ((FAILED++))
fi

if [ -f "packages/mcp-adapter/apps/components.css" ]; then
    test_result "components.css exists"
else
    echo -e "${RED}❌ FAIL${NC}: components.css not found"
    ((FAILED++))
fi

if [ -f "packages/mcp-adapter/apps/react-components.md" ]; then
    test_result "react-components.md exists"
else
    echo -e "${RED}❌ FAIL${NC}: react-components.md not found"
    ((FAILED++))
fi
echo ""

echo "5️⃣  Testing TypeScript compilation..."
pnpm --filter @surfacesui/components exec tsc --noEmit > /dev/null 2>&1
test_result "components TypeScript compilation"

pnpm --filter @surfacesui/mcp-adapter exec tsc --noEmit > /dev/null 2>&1
test_result "mcp-adapter TypeScript compilation"

pnpm --filter @surfacesui/server exec tsc --noEmit > /dev/null 2>&1
test_result "server TypeScript compilation"
echo ""

echo "6️⃣  Testing MCP server resources..."
node -e "
const { getSurfacesResources } = require('./packages/mcp-adapter/dist/index.js');
const resources = getSurfacesResources();
const cssResources = resources.filter(r => r.mimeType === 'text/css');
const docResources = resources.filter(r => r.mimeType === 'text/markdown');
const htmlResources = resources.filter(r => r.mimeType === 'text/html;profile=mcp-app');

console.log(\`Found \${resources.length} total resources\`);
console.log(\`  - \${htmlResources.length} HTML apps\`);
console.log(\`  - \${cssResources.length} CSS stylesheets\`);
console.log(\`  - \${docResources.length} documentation files\`);

if (cssResources.length !== 2) {
  console.error('Expected 2 CSS resources!');
  process.exit(1);
}
if (docResources.length !== 1) {
  console.error('Expected 1 doc resource!');
  process.exit(1);
}
if (htmlResources.length < 4) {
  console.error('Expected at least 4 HTML apps!');
  process.exit(1);
}
" 2>&1
test_result "MCP resource registry"
echo ""

echo "7️⃣  Testing test suites..."
pnpm test > /dev/null 2>&1
test_result "All test suites"
echo ""

echo "8️⃣  Testing linting..."
pnpm --filter @surfacesui/components lint > /dev/null 2>&1
test_result "ESLint checks"
echo ""

echo "================================"
echo "Test Results Summary"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo ""
    echo -e "${RED}⚠️  Some tests failed. Please review before merging.${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo -e "${GREEN}✅ All tests passed! Safe to merge.${NC}"
fi
