# Teradata Semantic Viewer - MCP Integration Plan
## Teradata-First, Database-Agnostic Design

**Project:** Semantic Database Viewer Component Library + MCP Server Integration
**Timeline:** 12-16 weeks
**Quality Policy:** P0/P1 bugs BLOCK phase completion (non-negotiable)
**Architecture:** Teradata-optimized with database abstraction layer

---

## EXECUTIVE SUMMARY

### What We're Building

An intelligent database automation platform delivered as MCP-UI components that:
- **Observes** database usage patterns (query frequency, performance, schema changes)
- **Recommends** optimizations (materialized views, indexes, caching strategies)
- **Plans** execution with safety checks and rollback plans
- **Executes** automatically (with approval) or on schedule
- **Monitors** data quality, performance anomalies, and system health

### Integration Strategy

**Primary Target:** Teradata Vantage via `vantage-mcp` (Go-based MCP server)
**Secondary Support:** PostgreSQL, MySQL, SQL Server (via abstraction layer)

### Architecture Decision

```
┌──────────────────────────────────────────────────────────────┐
│         MCP-UI Components (React + TypeScript)                │
│  • SchemaExplorer  • RecommendationCard  • PlanViewer        │
│  • JobMonitor  • SemanticQueryEditor  • AnomalyDashboard     │
└──────────────────────────────────────────────────────────────┘
                         ↕ MCP Bridge (useMcpTool)
┌──────────────────────────────────────────────────────────────┐
│     teradata-mcp-ui Server (Python FastMCP)                   │
│  • Tool Definitions  • UI Resources  • Request Routing        │
└──────────────────────────────────────────────────────────────┘
                         ↕ stdio JSON-RPC
┌──────────────────────────────────────────────────────────────┐
│     vantage-mcp (Go - ~/repos/vantage-mcp)                    │
│  • MCP Protocol (2024-11-05)  • JSON-RPC 2.0                 │
│  • Tools: teradata_execute_sql, get_last_result              │
│  • Resource Serving (HTML app bundles)                        │
│  • Lazy Connection Provider (teradatacli)                     │
└──────────────────────────────────────────────────────────────┘
                         ↕ BTEQ/tdcli (embedded)
                    Teradata Vantage

PARALLEL PATH (Future):
┌──────────────────────────────────────────────────────────────┐
│     Database Abstraction Layer (Python)                       │
│  • PostgreSQL Adapter  • MySQL Adapter  • Generic SQL         │
└──────────────────────────────────────────────────────────────┘
```

---

## VANTAGE-MCP INTEGRATION DETAILS

### vantage-mcp Repository (Go)

**Location:** `~/repos/vantage-mcp` (sibling repository)
**Language:** Go 1.25.0
**Protocol:** MCP 2024-11-05, JSON-RPC 2.0
**Transport:** Stdio only (stdin/stdout)

### Current MCP Tools Exposed (2 total)

| Tool Name | Purpose | Input | Output |
|-----------|---------|-------|--------|
| `teradata_execute_sql` | Execute SQL/BTEQ scripts | `sql` (string) | JSON results or success message |
| `get_last_result` | Retrieve last query result | None | Last query output from result store |

**Critical Constraint:** vantage-mcp exposes ONLY these 2 tools. Semantic viewer tools must be implemented in teradata-mcp-ui Python server as a proxy layer.

### Connection Configuration (Environment Variables)

**Required:**
- `TD_USER` - Teradata username
- `TD_PASSWORD` (or `TD_PASS`) - Teradata password
- `TD_DEFAULT_HOST` (or `TD_HOST`) - Teradata host/cluster

**Optional:**
- `TD_LOGMECH` - Login mechanism (TD, LDAP, KRB5, TDNEGO)
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `MCP_APPS_DIR` - Path to HTML app bundles (defaults to auto-detect)

### Lazy Connection Pattern

vantage-mcp uses **lazy initialization**:
1. Server starts without connecting to database
2. First tool call triggers connection via `LazyProvider.ensureInitialized()`
3. Connection pool created with embedded `teradatacli` library
4. Subsequent calls reuse pooled connections

**Implication for Semantic Viewer:** Schema inspection tools will trigger connection on first call. Plan for 2-3 second delay on initial request.

### Build & Run Process

**Build vantage-mcp:**
```bash
cd ~/repos/vantage-mcp
just build                    # Builds to ./bin/vantage-mcp
# OR
go build ./cmd/vantage-mcp    # Builds to ./vantage-mcp
```

**Run vantage-mcp (stdio mode):**
```bash
export TD_USER="dbc"
export TD_PASSWORD="dbc"
export TD_DEFAULT_HOST="localhost"
export LOG_LEVEL="info"
export MCP_APPS_DIR="$HOME/repos/teradata-mcp-ui/packages/components/dist/apps"

~/repos/vantage-mcp/bin/vantage-mcp
# Server listens on stdin, writes responses to stdout, logs to stderr
```

**Integration with teradata-mcp-ui Python server:**
```python
# In server/src/tools/semantic_observation.py
import subprocess

# Start vantage-mcp as subprocess (stdio mode)
vantage_process = subprocess.Popen(
    [VANTAGE_MCP_BINARY],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=VANTAGE_ENV,
)

# Send JSON-RPC request to vantage-mcp
request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
        "name": "teradata_execute_sql",
        "arguments": {"sql": "SELECT * FROM DBC.TablesV WHERE DatabaseName = 'my_db'"}
    }
}
vantage_process.stdin.write(json.dumps(request).encode() + b"\n")
vantage_process.stdin.flush()

# Read JSON-RPC response
response_line = vantage_process.stdout.readline()
response = json.loads(response_line)
```

### Resource Serving (HTML App Bundles)

vantage-mcp serves teradata-mcp-ui HTML apps as MCP resources:

1. **Auto-Discovery:** Looks for HTML files in:
   - `$MCP_APPS_DIR` (if set)
   - `../teradata-mcp-ui/packages/components/dist/apps` (sibling repo)
   - `./apps` (local directory)

2. **Resource URI Format:** `ui://{filename}` (e.g., `ui://sql-editor`)

3. **Parameter Injection:** Query params become `window.__MCP_PARAMS__`
   ```
   ui://sql-editor?sql=SELECT+*+FROM+table&autoExecute=true
   → window.__MCP_PARAMS__ = { sql: "SELECT * FROM table", autoExecute: "true" }
   ```

4. **Result Metadata:** Tool results include UI resource URIs:
   ```json
   {
     "content": [{"type": "text", "text": "..."}],
     "_meta": {
       "ui": {
         "resourceUri": "ui://sql-editor?sql=...&autoExecute=true"
       }
     }
   }
   ```

**Implication for Semantic Viewer:** New semantic viewer apps (schema-explorer.html, recommendations-panel.html) will be auto-discovered by vantage-mcp and served as resources.

### Error Handling & Analysis

vantage-mcp provides **comprehensive error analysis** for Teradata errors:

**Error Categories:**
- TableNotFound (error 3807)
- ObjectNotFound
- SyntaxError
- Timeout
- PermissionDenied
- ConnectionError
- SpoolSpaceError
- DataTypeError
- ColumnNotFound

**Example Error Response:**
```json
{
  "content": [{
    "type": "text",
    "text": "Error: [3807] Object 'MY_TABLE' does not exist.\n\nSuggestions:\n- Verify table name spelling\n- Check database name\n- Ensure you have SELECT privileges"
  }],
  "isError": true
}
```

**Implication for Semantic Viewer:** Schema inspection failures will return actionable error messages. UI should display these suggestions to users.

### Testing vantage-mcp

**Run Tests:**
```bash
cd ~/repos/vantage-mcp
just test                     # Run unit tests
just test-race                # Run with race detector
just test-coverage            # Run with coverage report
```

**Coverage Highlights:**
- MCP Protocol: 100.0%
- MCP Config: 86.4%
- MCP Transport (stdio): 77.8%
- BTEQ Execution: ~85%
- Zero race conditions

### Integration Validation Checklist

Before implementing semantic viewer tools, verify:

- [ ] vantage-mcp builds successfully (`just build`)
- [ ] vantage-mcp connects to Teradata (set TD_USER, TD_PASSWORD, TD_DEFAULT_HOST)
- [ ] `teradata_execute_sql` tool works (test with simple SELECT)
- [ ] Resource serving works (build teradata-mcp-ui, check `MCP_APPS_DIR`)
- [ ] Error handling returns structured errors (test with invalid SQL)
- [ ] Lazy connection initializes on first call (observe ~2s delay)
- [ ] Go dependencies resolve (`go mod tidy`, `go mod download`)

---

## KEY FINDINGS FROM RESEARCH

**1. Teradata Materialized Views = JOIN INDEX**
Teradata implements materialized views as **JOIN INDEX**, not standard `CREATE TABLE AS`. This is critical for Phase 1 recommendation engine design.

Sources:
- [Introduction to Materialized Views In Teradata](https://tensupport.teradata.com/library/materialview.pdf)
- [Syntax to create materialized views - Teradata Community](https://support.teradata.com/community?id=community_question&sys_id=9aef290c1b6b18904c2a3227dc4bcb5d)
- [Understanding The Teradata Join Index](https://www.dwhpro.com/teradata-join-index/)

---

## GLOBAL OPERATING RULES

**Applies to ALL agents:**

* Optimize for correctness over speed
* Be skeptical - assume integrations fail until proven otherwise
* No praise, no fluff - report facts only
* No speculation outside your domain
* Prefer false positives over missed critical issues
* Use concise, high-signal language
* Every bug must be tracked, fixed, tested, verified
* No phase completes until QA signs off with ZERO P0/P1 bugs

---

## OUTPUT SCHEMA (ALL AGENTS)

Return findings ONLY in this format:

```
BLOCKERS:
* [Issues preventing completion]

HIGH:
* [Critical issues requiring immediate attention]

MEDIUM:
* [Important issues to address]

LOW:
* [Nice-to-haves]

COMPLETED:
* [Deliverables finished]

BUGS:
P0: [N] (MUST BE 0)
P1: [N] (MUST BE 0)
P2: [N]
P3: [N]

READY: YES | NO [reason if NO]
```

If no issues: **"APPROVED - NO SIGNIFICANT FINDINGS"**

---

# PHASE 0 — REQUIREMENTS & ARCHITECTURE VALIDATION (2 days)

**Goal:** Validate technical feasibility, define MVP scope, establish database compatibility matrix

Run 5 agents in PARALLEL.

---

## AGENT 0A — DATABASE COMPATIBILITY AUDITOR

You are a database engineer who ensures portability.

**Your ONLY job:** Define what works on Teradata vs. other databases.

**Tasks:**
- Audit Teradata-specific features in semantic viewer proposal
- Map Teradata concepts to PostgreSQL/MySQL equivalents
- Identify features requiring database-specific implementations
- Define abstraction layer interface

**Teradata-Specific Features to Map:**
1. **Materialized Views** → Teradata uses `CREATE JOIN INDEX`, PostgreSQL uses `CREATE MATERIALIZED VIEW`, MySQL has no native support
2. **Statistics Collection** → Teradata `COLLECT STATISTICS`, PostgreSQL `ANALYZE`, MySQL `ANALYZE TABLE`
3. **Explain Plans** → Teradata `EXPLAIN`, PostgreSQL `EXPLAIN ANALYZE`, MySQL `EXPLAIN`
4. **Schema Metadata** → Teradata `DBC` views, PostgreSQL `information_schema`, MySQL `information_schema`
5. **Performance Metrics** → Teradata `DBQL` tables, PostgreSQL `pg_stat_*`, MySQL `performance_schema`

**SUCCESS CRITERIA:**
* Compatibility matrix complete (Teradata, PostgreSQL, MySQL)
* Abstraction layer interface defined
* MVP features flagged as Teradata-only or portable
* Zero ambiguities on database-specific syntax

**BLOCKERS:**
* No clear abstraction strategy for materialized views
* Unknown database-specific features in core flows
* Unclear how to detect database type at runtime

**DELIVERABLES:**
- docs/architecture/DATABASE_COMPATIBILITY_MATRIX.md
- docs/architecture/ABSTRACTION_LAYER_INTERFACE.md
- docs/architecture/TERADATA_SPECIFIC_FEATURES.md

---

## AGENT 0B — MCP INTEGRATION ARCHITECT

You are an MCP expert who ensures protocol compliance.

**Your ONLY job:** Design MCP tools that integrate seamlessly with vantage-mcp and teradata-mcp-ui patterns.

**Tasks:**
- Review existing vantage-mcp tool contracts (teradata_execute_sql, get_last_result)
- Design new MCP tools for semantic viewer (12-15 tools estimated)
- Define tool naming conventions (prefix with `semantic_*`)
- Map tool inputs/outputs to React component props
- Ensure compatibility with MCP Apps (Claude Desktop) and web contexts
- Design proxy layer in teradata-mcp-ui Python server

**Critical Design Decisions:**
1. **Tool Location:** Implement in teradata-mcp-ui Python server (NOT vantage-mcp)
   - Rationale: vantage-mcp exposes only 2 tools (teradata_execute_sql, get_last_result)
   - Semantic viewer tools will call vantage-mcp's teradata_execute_sql via stdio subprocess
2. **Tool Namespace:** Use `semantic_*` prefix (e.g., `semantic_schema_inspect`)
3. **Error Handling:** Follow vantage-mcp error format (structured errors with suggestions)
4. **Pagination:** List tools need pagination (observations, recommendations, query patterns)
5. **Streaming:** No streaming required for MVP (all synchronous calls)
6. **Authentication:** Use environment variables from vantage-mcp (TD_USER, TD_PASSWORD, TD_DEFAULT_HOST)

**vantage-mcp Constraint:**
- vantage-mcp is a **Go repository** at `~/repos/vantage-mcp`
- Only exposes 2 tools: `teradata_execute_sql`, `get_last_result`
- Runs as stdio subprocess (JSON-RPC 2.0)
- Lazy connection initialization (2-3s delay on first call)
- All new semantic viewer tools MUST be implemented in **teradata-mcp-ui Python server** and proxy to vantage-mcp

**SUCCESS CRITERIA:**
* 12-15 MCP tool definitions complete (JSON schemas)
* Tool naming follows `semantic_*` convention
* All tools have mock responses for development
* Error handling consistent with vantage-mcp format
* Pagination design for list tools
* Proxy pattern documented (Python → vantage-mcp stdio)

**BLOCKERS:**
* Unclear how to spawn vantage-mcp subprocess from Python
* Missing tool contracts for critical features
* No mock data strategy defined
* Unclear how to pass TD_* environment variables to vantage-mcp subprocess

**DELIVERABLES:**
- docs/mcp-tools/TOOL_DEFINITIONS.md (all 12-15 tools with JSON schemas)
- docs/mcp-tools/MOCK_DATA_STRATEGY.md
- docs/mcp-tools/ERROR_HANDLING.md
- server/src/tools/semantic_tools.py (stub implementations)

---

## AGENT 0C — REQUIREMENTS PRIORITIZER

You are a product manager who defines MVP scope ruthlessly.

**Your ONLY job:** Reduce 4-phase semantic viewer proposal to 12-week MVP.

**Original Proposal Phases:**
1. Foundation (Observation Layer)
2. Recommendations (Rule-based Engine)
3. Plan & Execution (Safety + Rollback)
4. Advanced (NL to SQL, Feature Engineering, Discovery)

**MVP Scope Constraints:**
- Timeline: 12 weeks max
- Team: 1-2 engineers
- Must integrate with existing teradata-mcp-ui
- Must work with vantage-mcp (no vantage-mcp modifications)

**Tasks:**
- Identify P0 features (must have for MVP)
- Flag Phase 4 features as post-MVP
- Define success metrics for MVP
- Create user story priority matrix

**Proposed MVP Scope:**
- ✅ Schema inspection and visualization
- ✅ Query pattern observation (passive monitoring)
- ✅ 3-5 basic recommendation rules
- ✅ Recommendation list/dismiss UI
- ✅ Manual execution only (no auto-mode)
- ❌ Plan generator (post-MVP)
- ❌ Execution engine (post-MVP)
- ❌ NL to SQL (post-MVP)
- ❌ Feature engineering (post-MVP)

**SUCCESS CRITERIA:**
* MVP feature list ≤20 user stories
* P0 features clearly defined
* Success metrics defined (qualitative OK for MVP)
* Timeline fits 12 weeks with buffer

**BLOCKERS:**
* Scope creep into execution engine
* Unclear MVP success criteria
* No user validation of MVP scope

**DELIVERABLES:**
- docs/requirements/MVP_SCOPE.md
- docs/requirements/USER_STORIES.md (prioritized)
- docs/requirements/POST_MVP_ROADMAP.md
- docs/requirements/SUCCESS_METRICS.md

---

## AGENT 0D — UX RESEARCH LEAD

You are a UX researcher who validates user needs before building.

**Your ONLY job:** Validate that semantic viewer solves real problems for Teradata users.

**Target Users:**
1. **Data Scientists** - Need fast data exploration, automated feature engineering
2. **Data Engineers** - Need performance optimization, proactive monitoring
3. **Database Admins** - Need schema management, query pattern analysis

**Tasks:**
- Interview 3-5 users per persona (9-15 total)
- Document current pain points (validated, not assumed)
- Map user workflows (as-is vs. to-be)
- Validate MVP scope with users
- Test terminology ("semantic viewer", "recommendations", "observations")

**Key Questions:**
- Do users currently track query patterns? How?
- What optimization tasks are most time-consuming?
- Would users trust automated recommendations? What info do they need?
- How do they currently inspect schemas?
- What's the approval threshold for automated changes?

**SUCCESS CRITERIA:**
* 9-15 interviews completed (3-5 per persona)
* Pain points validated (not assumed)
* MVP scope resonates with users
* Terminology tested and approved
* User mental models documented

**BLOCKERS:**
* Fewer than 9 interviews completed
* Users don't understand "semantic viewer" concept
* No validated pain points
* MVP scope misaligned with user needs

**DELIVERABLES:**
- docs/ux-research/USER_INTERVIEWS.md
- docs/ux-research/PAIN_POINTS.md
- docs/ux-research/USER_PERSONAS.md
- docs/ux-research/WORKFLOW_MAPS.md

---

## AGENT 0E — ACCESSIBILITY REQUIREMENTS LEAD

You are a WCAG auditor who prevents accessibility regressions.

**Your ONLY job:** Define accessibility requirements before ANY code is written.

**Tasks:**
- Define WCAG 2.1 AA compliance requirements (minimum)
- Document keyboard nav patterns (Tab, Enter, Escape, Arrows)
- Define color contrast requirements (4.5:1 normal, 3:1 large)
- Plan screen reader strategy (semantic HTML, ARIA labels)
- Create accessibility testing checklist

**Critical Components:**
- SchemaExplorer (tree navigation, expand/collapse)
- RecommendationCard (interactive cards, approve/dismiss)
- PlanViewer (stepper component, progress indicators)
- JobMonitor (real-time updates, status changes)
- SemanticQueryEditor (code editor, syntax highlighting)

**Keyboard Navigation Patterns:**
- Tree: Arrow keys navigate, Enter expands/collapses, Space selects
- Cards: Tab focuses, Enter/Space activates actions
- Modals: Escape closes, focus trapped, focus restored on close
- Editors: Tab inserts spaces (or Ctrl+Space for autocomplete)

**SUCCESS CRITERIA:**
* WCAG 2.1 AA requirements documented
* Keyboard nav patterns defined for all components
* Screen reader strategy planned
* Testing checklist ready
* Color palette validated (contrast ≥4.5:1)

**BLOCKERS:**
* Color contrast requirements unclear
* Keyboard nav patterns missing for tree component
* Screen reader strategy undefined

**DELIVERABLES:**
- docs/accessibility/WCAG_REQUIREMENTS.md
- docs/accessibility/KEYBOARD_NAVIGATION.md
- docs/accessibility/SCREEN_READER_GUIDE.md
- docs/accessibility/TESTING_CHECKLIST.md

---

## PHASE 0 GATE

**PROCEED only if:**
```
✅ Database Compatibility Auditor: Compatibility matrix complete
✅ MCP Integration Architect: 12-15 tool definitions ready
✅ Requirements Prioritizer: MVP scope ≤20 stories
✅ UX Research Lead: 9-15 interviews, validated pain points
✅ Accessibility Lead: WCAG 2.1 AA requirements defined
✅ 0 BLOCKERS across all agents
```

---

# PHASE 1 — MCP TOOLS & DATA MODEL (3 weeks)

**Goal:** Implement MCP server-side tools with mock data, design observation data model

Run 6 specialist agents in PARALLEL.

---

## AGENT 1A — OBSERVATION LAYER ARCHITECT

You think like a data engineer who designs for scale.

**Your ONLY job:** Design storage for query patterns, schema snapshots, performance metrics.

**Database Choice:** SQLite (local), PostgreSQL (production scale)

**Schema Design:**

```sql
-- Query Patterns
CREATE TABLE query_patterns (
    id INTEGER PRIMARY KEY,
    query_hash TEXT NOT NULL,          -- Normalized query signature
    query_template TEXT,               -- Parameterized query
    execution_count INTEGER DEFAULT 0,
    avg_duration_ms REAL,
    total_cost REAL,                   -- Teradata: CPU + I/O cost
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    users TEXT,                        -- JSON array of users
    tables TEXT,                       -- JSON array of tables
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_query_hash ON query_patterns(query_hash);
CREATE INDEX idx_last_seen ON query_patterns(last_seen);

-- Schema Snapshots (drift detection)
CREATE TABLE schema_snapshots (
    id INTEGER PRIMARY KEY,
    database_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    snapshot_data TEXT NOT NULL,       -- JSON: columns, types, constraints
    checksum TEXT NOT NULL,            -- SHA256 of snapshot_data
    row_count INTEGER,
    size_bytes INTEGER,
    snapshot_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_table_snapshot ON schema_snapshots(database_name, table_name, snapshot_timestamp);

-- Performance Metrics
CREATE TABLE performance_metrics (
    id INTEGER PRIMARY KEY,
    query_id TEXT,
    duration_ms REAL NOT NULL,
    rows_scanned INTEGER,
    rows_returned INTEGER,
    cpu_time_ms REAL,
    io_cost REAL,
    execution_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_execution_timestamp ON performance_metrics(execution_timestamp);

-- Observations (generic event log)
CREATE TABLE observations (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,                -- 'query_pattern', 'schema_change', 'performance'
    category TEXT,                     -- 'performance', 'quality', 'cost'
    severity TEXT,                     -- 'high', 'medium', 'low'
    data TEXT NOT NULL,                -- JSON blob
    observed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_observation_type ON observations(type, observed_at);
```

**Critical Checks:**
* All timestamps use ISO 8601 format
* JSON fields validated on insert
* Checksums use SHA256 (not MD5)
* Indexes on all foreign keys and timestamp columns
* Partitioning strategy for >1M rows (partition by month)

**SUCCESS CRITERIA:**
* Schema DDL ready for SQLite and PostgreSQL
* Migration scripts for schema upgrades
* Data retention policy defined (default: 90 days)
* Query patterns for common operations (aggregate, time-range, top-N)

**BLOCKERS:**
* Unclear how to capture Teradata query costs
* No strategy for schema snapshot comparison
* Missing data retention implementation

**DELIVERABLES:**
- database/schema.sql (SQLite + PostgreSQL compatible)
- database/migrations/ (versioned migration scripts)
- database/RETENTION_POLICY.md
- database/QUERY_PATTERNS.md

---

## AGENT 1B — MCP TOOL IMPLEMENTER (Observation Tools)

You are a Python engineer who implements MCP tools.

**Your ONLY job:** Implement 5 observation-related MCP tools with mock data.

**Tools to Implement:**

### 1. `semantic_schema_inspect`
```python
{
  "name": "semantic_schema_inspect",
  "description": "Inspect database schema with statistics",
  "inputSchema": {
    "type": "object",
    "properties": {
      "database": {"type": "string", "description": "Database name (optional)"},
      "table": {"type": "string", "description": "Table name (optional)"},
      "include_stats": {"type": "boolean", "default": True}
    }
  }
}
```

### 2. `semantic_query_patterns_list`
```python
{
  "name": "semantic_query_patterns_list",
  "description": "List observed query patterns",
  "inputSchema": {
    "type": "object",
    "properties": {
      "time_range": {"type": "object", "description": "Start/end timestamps"},
      "min_executions": {"type": "integer", "default": 1},
      "sort_by": {"type": "string", "enum": ["frequency", "duration", "cost"]},
      "limit": {"type": "integer", "default": 50}
    }
  }
}
```

### 3. `semantic_schema_drift_detect`
```python
{
  "name": "semantic_schema_drift_detect",
  "description": "Compare current schema to previous snapshot",
  "inputSchema": {
    "type": "object",
    "properties": {
      "database": {"type": "string"},
      "table": {"type": "string"},
      "compare_to": {"type": "string", "description": "Snapshot ID or timestamp"}
    },
    "required": ["database", "table"]
  }
}
```

### 4. `semantic_performance_metrics`
```python
{
  "name": "semantic_performance_metrics",
  "description": "Get performance metrics for queries",
  "inputSchema": {
    "type": "object",
    "properties": {
      "time_range": {"type": "object"},
      "metric": {"type": "string", "enum": ["duration", "cpu", "io"]},
      "aggregation": {"type": "string", "enum": ["p50", "p95", "p99", "avg"]}
    }
  }
}
```

### 5. `semantic_observations_query`
```python
{
  "name": "semantic_observations_query",
  "description": "Query observation log",
  "inputSchema": {
    "type": "object",
    "properties": {
      "type": {"type": "string", "enum": ["query_pattern", "schema_change", "performance"]},
      "category": {"type": "string", "enum": ["performance", "quality", "cost"]},
      "time_range": {"type": "object"},
      "limit": {"type": "integer", "default": 100}
    }
  }
}
```

**Implementation Pattern (all tools):**
```python
async def semantic_schema_inspect_tool(
    database: str | None,
    table: str | None,
    include_stats: bool,
    mock_mode: bool,
    vantage_binary: str,  # Path to ~/repos/vantage-mcp/bin/vantage-mcp
    vantage_env: dict,    # TD_USER, TD_PASSWORD, TD_DEFAULT_HOST, etc.
) -> str:
    if mock_mode:
        return _get_mock_schema_data(database, table, include_stats)

    # Call vantage-mcp for real data (stdio mode only)
    # vantage-mcp exposes teradata_execute_sql tool
    sql_query = _build_schema_query(database, table, include_stats)

    # Call vantage-mcp via stdio subprocess
    result = await _call_vantage_mcp_stdio(
        binary=vantage_binary,
        tool_name="teradata_execute_sql",
        arguments={"sql": sql_query},
        env=vantage_env,
    )

    # Store observation in SQLite
    await _store_observation("schema_inspect", result)

    return json.dumps(result)

# Helper function for vantage-mcp stdio communication
async def _call_vantage_mcp_stdio(
    binary: str,
    tool_name: str,
    arguments: dict,
    env: dict,
) -> dict:
    """
    Call vantage-mcp tool via stdio JSON-RPC 2.0.

    vantage-mcp is a Go binary at ~/repos/vantage-mcp/bin/vantage-mcp
    It reads JSON-RPC requests from stdin, writes responses to stdout.
    """
    import subprocess

    # Start vantage-mcp process
    process = subprocess.Popen(
        [binary],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )

    # Build JSON-RPC request
    request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": tool_name,
            "arguments": arguments,
        }
    }

    # Send request to vantage-mcp
    process.stdin.write(json.dumps(request).encode() + b"\n")
    process.stdin.flush()

    # Read response from vantage-mcp
    response_line = process.stdout.readline()
    response = json.loads(response_line)

    # Cleanup
    process.stdin.close()
    process.wait()

    # Extract result from JSON-RPC response
    if "error" in response:
        raise Exception(f"vantage-mcp error: {response['error']}")

    return response["result"]
```

**SUCCESS CRITERIA:**
* All 5 tools registered in server/src/main.py
* Mock data returns realistic JSON responses
* Error handling for invalid inputs
* Timeout handling (30s default)
* Observation storage working (SQLite)

**BLOCKERS:**
* Unclear how to extract schema from vantage-mcp
* No mock data generator
* Missing observation storage implementation

**DELIVERABLES:**
- server/src/tools/semantic_observation.py (5 tool implementations)
- server/src/tools/semantic_observation_mocks.py (mock data generator)
- server/src/tools/semantic_observation_storage.py (SQLite storage)

---

## AGENT 1C — MCP TOOL IMPLEMENTER (Recommendation Tools)

You are a Python engineer who implements MCP tools.

**Your ONLY job:** Implement 4 recommendation-related MCP tools with mock data.

**Tools to Implement:**

### 1. `semantic_recommendations_list`
```python
{
  "name": "semantic_recommendations_list",
  "description": "List active optimization recommendations",
  "inputSchema": {
    "type": "object",
    "properties": {
      "category": {"type": "string", "enum": ["performance", "quality", "cost", "all"]},
      "priority": {"type": "string", "enum": ["high", "medium", "low", "all"]},
      "status": {"type": "string", "enum": ["active", "dismissed", "all"]},
      "limit": {"type": "integer", "default": 20}
    }
  }
}
```

### 2. `semantic_recommendations_generate`
```python
{
  "name": "semantic_recommendations_generate",
  "description": "Generate recommendations from observations",
  "inputSchema": {
    "type": "object",
    "properties": {
      "force_refresh": {"type": "boolean", "default": False},
      "rules": {"type": "array", "items": {"type": "string"}}
    }
  }
}
```

### 3. `semantic_recommendation_dismiss`
```python
{
  "name": "semantic_recommendation_dismiss",
  "description": "Dismiss or snooze a recommendation",
  "inputSchema": {
    "type": "object",
    "properties": {
      "recommendation_id": {"type": "string"},
      "action": {"type": "string", "enum": ["dismiss", "snooze"]},
      "snooze_until": {"type": "string", "format": "date-time"}
    },
    "required": ["recommendation_id", "action"]
  }
}
```

### 4. `semantic_recommendation_get`
```python
{
  "name": "semantic_recommendation_get",
  "description": "Get detailed recommendation info",
  "inputSchema": {
    "type": "object",
    "properties": {
      "recommendation_id": {"type": "string"}
    },
    "required": ["recommendation_id"]
  }
}
```

**Recommendation Data Model:**
```python
@dataclass
class Recommendation:
    id: str
    type: str  # "materialized_view", "add_index", "cache_query"
    priority: str  # "high", "medium", "low"
    category: str  # "performance", "quality", "cost"
    title: str
    description: str
    score: float  # 0-100
    confidence: float  # 0-1

    estimated_impact: dict  # {"time_saved": "11.3 hrs/day", "cost_saved": "$340/month"}
    proposed_action: dict  # {"type": "create_join_index", "sql": "CREATE JOIN INDEX..."}
    rollback_plan: str

    created_at: str  # ISO 8601
    status: str  # "active", "dismissed", "snoozed"
    dismissed_at: str | None
    dismissed_by: str | None
```

**SUCCESS CRITERIA:**
* All 4 tools registered
* Mock recommendations realistic (3-5 examples)
* CRUD operations work (list, get, dismiss)
* Recommendation scoring algorithm documented
* Status transitions validated

**BLOCKERS:**
* No recommendation scoring algorithm defined
* Unclear recommendation data persistence strategy
* Missing mock recommendation templates

**DELIVERABLES:**
- server/src/tools/semantic_recommendation.py (4 tool implementations)
- server/src/tools/semantic_recommendation_mocks.py
- server/src/tools/semantic_recommendation_rules.py (3-5 rule implementations)
- server/src/tools/RECOMMENDATION_SCORING.md

---

## AGENT 1D — REACT COMPONENT ARCHITECT

You are a React architect who designs component APIs.

**Your ONLY job:** Design React component interfaces (props, events, data flow).

**Components to Design (MVP):**

### 1. SchemaExplorer
```typescript
interface SchemaExplorerProps {
  initialDatabase?: string;
  initialTable?: string;
  onTableSelect?: (database: string, table: string) => void;
  showStatistics?: boolean;
  className?: string;
}
```

**Size:** Organism (250-350 lines)
**Sub-components:** DatabaseNode, TableNode, ColumnList, StatisticsPanel

### 2. RecommendationCard
```typescript
interface RecommendationCardProps {
  recommendation: Recommendation;
  onDismiss?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  showImpact?: boolean;
  className?: string;
}
```

**Size:** Molecule (100-150 lines)
**Sub-components:** PriorityBadge, ImpactMetrics, ActionButtons

### 3. RecommendationList
```typescript
interface RecommendationListProps {
  filters?: {
    category?: 'performance' | 'quality' | 'cost' | 'all';
    priority?: 'high' | 'medium' | 'low' | 'all';
  };
  onFilterChange?: (filters: Filters) => void;
  onDismiss?: (id: string) => void;
  className?: string;
}
```

**Size:** Organism (200-300 lines)
**Uses:** useMcpTool('semantic_recommendations_list')

### 4. QueryPatternList
```typescript
interface QueryPatternListProps {
  timeRange?: { start: string; end: string };
  sortBy?: 'frequency' | 'duration' | 'cost';
  onPatternSelect?: (patternId: string) => void;
  className?: string;
}
```

**Size:** Organism (150-250 lines)
**Uses:** useMcpTool('semantic_query_patterns_list')

### 5. SemanticDashboard
```typescript
interface SemanticDashboardProps {
  title?: string;
  showRecommendations?: boolean;
  showQueryPatterns?: boolean;
  showSchemaDrift?: boolean;
  className?: string;
}
```

**Size:** Organism (300-400 lines)
**Composition:** Combines SchemaExplorer, RecommendationList, QueryPatternList

**Design Principles:**
- All components use MCP Bridge (useMcpTool) - NO direct API calls
- All colors via CSS variables (--background, --foreground, etc.)
- Keyboard navigation required (Tab, Enter, Escape)
- ARIA labels for screen readers
- Loading states for all async operations
- Error boundaries for resilience
- Max 400 lines per component (decompose if larger)

**SUCCESS CRITERIA:**
* 5 component interfaces designed
* Props documented with TypeScript types
* Data flow diagrams created
* Atomic design categories assigned
* Size estimates validated (<400 lines each)

**BLOCKERS:**
* Unclear component composition strategy
* Missing data flow for recommendations
* No loading state patterns defined

**DELIVERABLES:**
- docs/components/COMPONENT_INTERFACES.md
- docs/components/DATA_FLOW_DIAGRAMS.md
- docs/components/ATOMIC_DESIGN_BREAKDOWN.md
- packages/components/src/components/semantic-viewer/types.ts (type stubs)

---

## AGENT 1E — UI RESOURCE PLANNER

You are a frontend architect who plans MCP-UI apps.

**Your ONLY job:** Plan HTML app bundles for semantic viewer components.

**MCP-UI Apps to Create:**

### 1. semantic-viewer.html
**Description:** Full semantic viewer dashboard
**Components:** SemanticDashboard (top-level)
**MCP Tools:** All semantic_* tools
**Size Estimate:** ~800KB gzipped (includes ECharts for visualizations)

### 2. schema-explorer.html
**Description:** Standalone schema browser
**Components:** SchemaExplorer
**MCP Tools:** semantic_schema_inspect, semantic_schema_drift_detect
**Size Estimate:** ~300KB gzipped

### 3. recommendations-panel.html
**Description:** Recommendation dashboard
**Components:** RecommendationList, RecommendationCard
**MCP Tools:** semantic_recommendations_*, semantic_recommendation_*
**Size Estimate:** ~350KB gzipped

**App Structure (Example: semantic-viewer.tsx):**
```typescript
import React from 'react';
import { createRoot } from 'react-dom/client';
import { McpAppsBridge } from '../bridge/McpAppsBridge';
import { McpBridgeProvider } from '../bridge/McpBridgeProvider';
import { SemanticDashboard } from '../components/semantic-viewer/SemanticDashboard';
import '../theme/tokens.css';

const bridge = new McpAppsBridge();

function App() {
  return (
    <McpBridgeProvider bridge={bridge}>
      <div className="min-h-screen w-full p-4 bg-background">
        <SemanticDashboard
          title="Semantic Database Viewer"
          showRecommendations={true}
          showQueryPatterns={true}
          showSchemaDrift={true}
        />
      </div>
    </McpBridgeProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
```

**SUCCESS CRITERIA:**
* 3 MCP-UI app specs complete
* Bundle size estimates <500KB each
* Vite build config updated
* UI resources registered in server/src/resources/ui.py

**BLOCKERS:**
* Bundle size exceeds 500KB limit
* Unclear which components go in which app
* Missing Vite configuration for apps

**DELIVERABLES:**
- docs/apps/MCP_UI_APPS_SPEC.md
- packages/components/vite.config.apps.ts (updated)
- server/src/resources/ui.py (updated)

---

## AGENT 1F — DATABASE ABSTRACTION IMPLEMENTER

You are a Python engineer who designs for portability.

**Your ONLY job:** Implement database abstraction layer for Teradata, PostgreSQL, MySQL.

**Abstraction Interface:**

```python
class DatabaseAdapter(ABC):
    """Abstract base class for database-specific operations."""

    @abstractmethod
    async def get_schema(self, database: str, table: str | None) -> dict:
        """Get schema information for database/table."""
        pass

    @abstractmethod
    async def get_table_stats(self, database: str, table: str) -> dict:
        """Get row count, size, last modified for table."""
        pass

    @abstractmethod
    async def get_query_plan(self, query: str) -> dict:
        """Get query execution plan."""
        pass

    @abstractmethod
    async def get_query_cost(self, query: str) -> float:
        """Estimate query cost (CPU + I/O)."""
        pass

    @abstractmethod
    def format_materialized_view(self, name: str, query: str) -> str:
        """Generate SQL for materialized view (Teradata: JOIN INDEX)."""
        pass

    @abstractmethod
    def format_index(self, table: str, columns: list[str]) -> str:
        """Generate SQL for index."""
        pass
```

**Implementations:**

### TeradataAdapter
```python
class TeradataAdapter(DatabaseAdapter):
    async def get_schema(self, database: str, table: str | None) -> dict:
        # Query DBC.ColumnsV for column metadata
        query = """
        SELECT
            DatabaseName, TableName, ColumnName, ColumnType,
            ColumnLength, Nullable, DefaultValue
        FROM DBC.ColumnsV
        WHERE DatabaseName = ?
        """ + (f" AND TableName = ?" if table else "")
        # Execute via vantage-mcp...

    def format_materialized_view(self, name: str, query: str) -> str:
        # Teradata uses JOIN INDEX for materialized views
        return f"CREATE JOIN INDEX {name} AS {query} PRIMARY INDEX (...);"
```

### PostgreSQLAdapter
```python
class PostgreSQLAdapter(DatabaseAdapter):
    async def get_schema(self, database: str, table: str | None) -> dict:
        # Query information_schema.columns
        query = """
        SELECT
            table_catalog, table_schema, table_name, column_name,
            data_type, character_maximum_length, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
        """ + (f" AND table_name = $2" if table else "")
        # Execute...

    def format_materialized_view(self, name: str, query: str) -> str:
        return f"CREATE MATERIALIZED VIEW {name} AS {query};"
```

### MySQLAdapter
```python
class MySQLAdapter(DatabaseAdapter):
    async def get_schema(self, database: str, table: str | None) -> dict:
        # Query information_schema.columns
        query = """
        SELECT
            TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
        FROM information_schema.columns
        WHERE TABLE_SCHEMA = %s
        """ + (f" AND TABLE_NAME = %s" if table else "")
        # Execute...

    def format_materialized_view(self, name: str, query: str) -> str:
        # MySQL doesn't support materialized views natively
        # Use CREATE TABLE AS workaround
        return f"CREATE TABLE {name} AS {query};"
```

**Adapter Selection:**
```python
def get_database_adapter(connection_info: dict) -> DatabaseAdapter:
    """Factory function to get appropriate database adapter."""
    db_type = connection_info.get("type", "teradata").lower()

    if db_type == "teradata":
        return TeradataAdapter(connection_info)
    elif db_type == "postgresql":
        return PostgreSQLAdapter(connection_info)
    elif db_type == "mysql":
        return MySQLAdapter(connection_info)
    else:
        raise ValueError(f"Unsupported database type: {db_type}")
```

**SUCCESS CRITERIA:**
* Abstract base class defined (6 core methods)
* TeradataAdapter fully implemented
* PostgreSQLAdapter implemented (or stubbed with clear TODOs)
* MySQLAdapter implemented (or stubbed with clear TODOs)
* Factory function for adapter selection
* Unit tests for each adapter

**BLOCKERS:**
* Unclear how to detect database type (from connection string?)
* Missing PostgreSQL/MySQL connection testing
* No migration strategy from vantage-mcp-only to multi-DB

**DELIVERABLES:**
- server/src/database/adapter.py (abstract base class)
- server/src/database/teradata_adapter.py (full implementation)
- server/src/database/postgresql_adapter.py (implementation or stub)
- server/src/database/mysql_adapter.py (implementation or stub)
- server/src/database/tests/ (unit tests)

---

## AGENT 1-META — PHASE 1 INTEGRATION REVIEWER

You are a CTO who spots integration gaps.

**Your ONLY job:** Find conflicts between Phase 1 designs.

**Must Check:**
* Do MCP tools match React component props?
* Does observation data model support recommendation rules?
* Does database abstraction cover all MCP tool needs?
* Do component sizes fit 400-line limit?
* Are MCP-UI apps correctly configured?
* Does mock data support all UI states?

**OUTPUT:**
```
CROSS-DOMAIN CONFLICTS: [list]
MISSING INTEGRATION POINTS: [list]
SCALABILITY RISKS: [ranked 1-5]

ARCHITECTURE RISK SCORE: 0-10
  0-3: Green light
  4-6: Needs revision
  7-10: Major redesign

RECOMMENDATION: PROCEED | REVISE | BLOCK
```

**DELIVERABLES:**
- docs/phase1-review/INTEGRATION_REVIEW.md
- docs/phase1-review/RISK_ASSESSMENT.md

---

## PHASE 1 GATE

**PROCEED only if:**
```
✅ Architecture Risk Score ≤3
✅ All BLOCKERS resolved
✅ All 6 specialists approve
✅ 0 cross-domain conflicts
✅ Mock data supports all UI states
✅ Database abstraction covers Teradata + 1 other DB
```

---

# PHASE 2 — REACT COMPONENTS & INTEGRATION (4 weeks)

**Goal:** Implement MVP components with WCAG 2.1 AA compliance, 80% coverage, 0 P0/P1 bugs

Sprint cycle: 2 weeks → integration test → bug fix → proceed

Run 7 implementation agents in PARALLEL.

---

## AGENT 2A — SCHEMA EXPLORER IMPLEMENTER

You are a React engineer who builds accessible tree components.

**Your ONLY job:** Implement SchemaExplorer with keyboard navigation and WCAG 2.1 AA compliance.

**Sprint 1 Deliverables:**
- Component scaffold with useMcpTool integration
- Tree structure (database → table → column hierarchy)
- Expand/collapse functionality
- Loading states

**Sprint 2 Deliverables:**
- Keyboard navigation (Arrow keys, Enter, Space)
- Focus management
- Statistics panel
- Schema drift indicators
- Unit tests (80% coverage)
- A11y tests (axe-core)

**Component Structure:**
```
schema-explorer/
├── index.ts
├── SchemaExplorer.tsx           # Main component (250-300 lines)
├── DatabaseNode.tsx             # Tree node for database (50-80 lines)
├── TableNode.tsx                # Tree node for table (80-120 lines)
├── ColumnList.tsx               # Column details (60-100 lines)
├── StatisticsPanel.tsx          # Row count, size, etc. (60-80 lines)
├── types.ts
├── hooks.ts                     # useSchemaTree custom hook
└── __tests__/
    ├── SchemaExplorer.test.tsx
    ├── SchemaExplorer.a11y.test.tsx
    └── SchemaExplorer.integration.test.tsx
```

**SUCCESS CRITERIA:**
* Keyboard navigation: Arrow keys, Enter (expand), Space (select)
* ARIA attributes: role="tree", aria-expanded, aria-level
* Focus indicators visible (3px outline)
* Color contrast ≥4.5:1
* Screen reader tested (announces tree structure)
* Loading states for async data
* Error boundaries handle failures
* 80% test coverage
* 0 axe-core violations

**DAILY STATUS:**
```
COMPONENTS: [X/5]
KEYBOARD_NAV: WORKING | ISSUES
ACCESSIBILITY: P0:[N], P1:[N] (MUST BE 0)
TEST_COVERAGE: [X%]
BUGS: P0:[N], P1:[N]
READY: YES | NO
```

**DELIVERABLES:**
- packages/components/src/components/schema-explorer/ (all files)

---

## AGENT 2B — RECOMMENDATION COMPONENTS IMPLEMENTER

You are a React engineer who builds interactive cards.

**Your ONLY job:** Implement RecommendationCard and RecommendationList with WCAG 2.1 AA compliance.

**Sprint 1 Deliverables:**
- RecommendationCard component
- RecommendationList with useMcpTool integration
- Filter controls (category, priority)
- Loading states

**Sprint 2 Deliverables:**
- Dismiss/snooze actions
- Impact metrics display
- Keyboard navigation
- Unit tests (80% coverage)
- A11y tests (axe-core)

**Component Structure:**
```
recommendations/
├── index.ts
├── RecommendationCard.tsx       # Card component (100-150 lines)
├── RecommendationList.tsx       # List with filters (200-250 lines)
├── PriorityBadge.tsx            # Badge atom (30-40 lines)
├── ImpactMetrics.tsx            # Metrics display (60-80 lines)
├── FilterBar.tsx                # Filter controls (80-100 lines)
├── types.ts
└── __tests__/
    ├── RecommendationCard.test.tsx
    ├── RecommendationCard.a11y.test.tsx
    ├── RecommendationList.test.tsx
    ├── RecommendationList.a11y.test.tsx
    └── RecommendationList.integration.test.tsx
```

**SUCCESS CRITERIA:**
* Tab navigation between cards
* Enter/Space activates buttons
* Escape dismisses modals
* Focus trapped in modals
* Color contrast ≥4.5:1
* Screen reader announces card actions
* Optimistic updates with rollback
* 80% test coverage
* 0 axe-core violations

**DAILY STATUS:**
```
COMPONENTS: [X/5]
KEYBOARD_NAV: WORKING | ISSUES
ACCESSIBILITY: P0:[N], P1:[N] (MUST BE 0)
TEST_COVERAGE: [X%]
BUGS: P0:[N], P1:[N]
READY: YES | NO
```

**DELIVERABLES:**
- packages/components/src/components/recommendations/ (all files)

---

## AGENT 2C — QUERY PATTERN COMPONENTS IMPLEMENTER

You are a React engineer who builds data tables.

**Your ONLY job:** Implement QueryPatternList with sorting and filtering.

**Sprint 1 Deliverables:**
- QueryPatternList component
- Table layout with columns (query, frequency, duration, cost)
- Sort controls (click column headers)
- Loading states

**Sprint 2 Deliverables:**
- Time range filter
- Pagination
- Keyboard navigation (Tab, Arrow keys for table)
- Unit tests (80% coverage)
- A11y tests (axe-core)

**Component Structure:**
```
query-patterns/
├── index.ts
├── QueryPatternList.tsx         # List component (150-200 lines)
├── QueryPatternRow.tsx          # Table row (60-80 lines)
├── SortableHeader.tsx           # Column header (40-60 lines)
├── TimeRangeFilter.tsx          # Date range picker (80-100 lines)
├── types.ts
└── __tests__/
    ├── QueryPatternList.test.tsx
    ├── QueryPatternList.a11y.test.tsx
    └── QueryPatternList.integration.test.tsx
```

**SUCCESS CRITERIA:**
* Table sortable by any column
* Arrow keys navigate table cells
* Enter activates row actions
* Time range picker keyboard accessible
* Pagination with Page Up/Down
* Color contrast ≥4.5:1
* Screen reader announces table structure
* 80% test coverage
* 0 axe-core violations

**DAILY STATUS:**
```
COMPONENTS: [X/4]
KEYBOARD_NAV: WORKING | ISSUES
ACCESSIBILITY: P0:[N], P1:[N] (MUST BE 0)
TEST_COVERAGE: [X%]
BUGS: P0:[N], P1:[N]
READY: YES | NO
```

**DELIVERABLES:**
- packages/components/src/components/query-patterns/ (all files)

---

## AGENT 2D — SEMANTIC DASHBOARD IMPLEMENTER

You are a React engineer who composes complex layouts.

**Your ONLY job:** Implement SemanticDashboard that combines all semantic viewer components.

**Sprint 1 Deliverables:**
- Dashboard layout (3-column or tabs)
- Component composition (SchemaExplorer, RecommendationList, QueryPatternList)
- Responsive design (mobile, tablet, desktop)

**Sprint 2 Deliverables:**
- Inter-component communication (select table → filter recommendations)
- Dashboard state management
- Keyboard shortcuts (Ctrl+1/2/3 switch tabs)
- Unit tests (80% coverage)
- Integration tests

**Component Structure:**
```
semantic-dashboard/
├── index.ts
├── SemanticDashboard.tsx        # Main dashboard (300-350 lines)
├── DashboardLayout.tsx          # Layout wrapper (80-100 lines)
├── PanelContainer.tsx           # Panel wrapper (40-60 lines)
├── types.ts
├── hooks.ts                     # useSemanticContext
└── __tests__/
    ├── SemanticDashboard.test.tsx
    ├── SemanticDashboard.integration.test.tsx
```

**SUCCESS CRITERIA:**
* Components communicate via shared context
* Layout responsive (mobile: stacked, desktop: 3-column)
* Keyboard shortcuts work (Ctrl+1, Ctrl+2, Ctrl+3)
* Focus management between panels
* State persists on re-mount (local storage)
* 80% test coverage
* 0 P0/P1 bugs

**DAILY STATUS:**
```
LAYOUT: COMPLETE | IN_PROGRESS
INTER_COMPONENT_COMM: WORKING | BROKEN
RESPONSIVE: MOBILE | TABLET | DESKTOP | ALL
BUGS: P0:[N], P1:[N]
READY: YES | NO
```

**DELIVERABLES:**
- packages/components/src/components/semantic-dashboard/ (all files)

---

## AGENT 2E — MCP APPS BUNDLER

You are a frontend build engineer.

**Your ONLY job:** Create MCP-UI app bundles and integrate with server.

**Sprint 1 Deliverables:**
- semantic-viewer.tsx + .html
- schema-explorer.tsx + .html
- recommendations-panel.tsx + .html
- Vite config updated

**Sprint 2 Deliverables:**
- Build optimization (code splitting, tree shaking)
- Bundle size validation (<500KB each)
- UI resources registered in Python server
- Test in MCP Apps environment (Claude Desktop)

**Files to Create:**
```
packages/components/src/apps/
├── semantic-viewer.tsx
├── semantic-viewer.html
├── schema-explorer.tsx
├── schema-explorer.html
├── recommendations-panel.tsx
└── recommendations-panel.html
```

**Vite Config Update:**
```typescript
rollupOptions: {
  input: {
    'sql-editor': resolve(__dirname, 'src/apps/sql-editor.html'),
    'semantic-viewer': resolve(__dirname, 'src/apps/semantic-viewer.html'),
    'schema-explorer': resolve(__dirname, 'src/apps/schema-explorer.html'),
    'recommendations-panel': resolve(__dirname, 'src/apps/recommendations-panel.html'),
  },
}
```

**Server Resource Registration:**
```python
UI_APPS = {
    "sql-editor": {...},
    "semantic-viewer": {
        "name": "Semantic Database Viewer",
        "description": "Intelligent database automation platform",
        "mimeType": MCP_APP_MIME_TYPE,
    },
    "schema-explorer": {
        "name": "Schema Explorer",
        "description": "Interactive database schema browser with drift detection",
        "mimeType": MCP_APP_MIME_TYPE,
    },
    "recommendations-panel": {
        "name": "Optimization Recommendations",
        "description": "Database optimization recommendations dashboard",
        "mimeType": MCP_APP_MIME_TYPE,
    },
}
```

**SUCCESS CRITERIA:**
* All 3 apps build successfully
* Bundle sizes <500KB gzipped each
* Apps load in Claude Desktop
* MCP bridge connects successfully
* All tools callable from apps

**DAILY STATUS:**
```
APPS_BUILT: [X/3]
BUNDLE_SIZES: semantic:[X KB], schema:[X KB], rec:[X KB]
MCP_CONNECTION: WORKING | BROKEN
BUGS: P0:[N], P1:[N]
READY: YES | NO
```

**DELIVERABLES:**
- packages/components/src/apps/ (6 new files)
- packages/components/vite.config.apps.ts (updated)
- server/src/resources/ui.py (updated)

---

## AGENT 2F — QA AUTOMATION

You are a QA engineer who finds bugs before users do.

**Your ONLY job:** Write tests for ALL code, find ALL bugs, verify ALL fixes.

**Continuous Testing:**
- Unit tests (80% coverage minimum)
- Integration tests (MCP bridge, all tools)
- E2E tests (user workflows)
- Accessibility tests (axe-core + manual)
- Regression suite daily
- Bug tracking and verification

**Testing Priorities:**
1. **Unit** (every component, every hook)
2. **Integration** (MCP tools, bridge communication)
3. **E2E** (critical workflows: inspect schema, view recommendations, dismiss)
4. **Accessibility** (keyboard nav, screen reader, contrast)
5. **Performance** (component render time <100ms)
6. **Error handling** (network failures, timeouts)

**Bug Triage:**
- P0 (blocker): Component crashes, MCP bridge fails, WCAG violations
- P1 (critical): Feature broken (no workaround), incorrect data
- P2 (major): Feature degraded (workaround exists)
- P3 (minor): Polish, UX improvements

**DAILY STATUS:**
```
TESTS_RUN: [X]
PASSING: [X/Y]
COVERAGE: Backend:[X%], Frontend:[X%]
BUGS: P0:[N], P1:[N], P2:[N], P3:[N]
ACCESSIBILITY_BUGS: P0:[N], P1:[N]
RECOMMENDATION: PROCEED | EXTEND_SPRINT | BLOCK
```

**DELIVERABLES:**
- Test suites for all components
- Integration test suite (MCP bridge)
- E2E test suite (Playwright or Cypress)
- Accessibility test reports
- Bug tracking spreadsheet

---

## AGENT 2G — UX VALIDATION

You conduct usability tests during development.

**Your ONLY job:** Validate users can complete tasks with semantic viewer.

**Continuous Testing:**
- Test with 2-3 users per sprint (6-9 total)
- Validate component usability
- Identify friction points
- Measure task completion rate
- Track SUS score

**Critical Workflows:**
1. **Schema Exploration**: Find table, view columns, check stats (target: 100% completion)
2. **View Recommendations**: Open recommendations, understand impact, dismiss (target: 90% completion)
3. **Query Patterns**: Find slow queries, sort by duration (target: 90% completion)

**WEEKLY STATUS:**
```
USERS_TESTED: [X/3]
TASK_COMPLETION: Workflow1:[X%], Workflow2:[X%], Workflow3:[X%]
SUS_SCORE: [X/100] (target ≥70)
CRITICAL_UX_ISSUES: [N] (MUST BE 0)
FRICTION_POINTS: [list]
RECOMMENDATION: SHIP | ITERATE
```

**DELIVERABLES:**
- User testing reports (per sprint)
- Usability issue log
- SUS score tracking
- Friction point documentation

---

## AGENT 2-SPRINT-REVIEWER

**Your ONLY job:** Decide PROCEED or EXTEND SPRINT.

**PROCEED only if:**
```
✅ All acceptance criteria met
✅ P0/P1 bugs = 0
✅ P0/P1 accessibility bugs = 0
✅ Coverage ≥80% frontend
✅ Integration tests 100% passing
✅ Performance: component render <100ms
✅ WCAG 2.1 AA achieved
✅ SUS ≥70, task completion ≥80%
✅ Bundle sizes <500KB
```

**If NOT ready:** EXTEND SPRINT until criteria met.

**OUTPUT:**
```
DECISION: PROCEED | EXTEND | BLOCK
RATIONALE: [1 sentence]
CRITICAL_BLOCKERS: [list if EXTEND/BLOCK]
```

---

## PHASE 2 GATE

**PROCEED only if:**
```
✅ All sprints PROCEED
✅ All 5 component groups complete
✅ All 3 MCP-UI apps built and tested
✅ P0/P1 bugs = 0
✅ P0/P1 accessibility bugs = 0
✅ WCAG 2.1 AA achieved
✅ Coverage ≥80% frontend
✅ All integration tests passing
✅ UX validation passed (SUS ≥70)
```

---

# PHASE 3 — PRODUCTION HARDENING (2 weeks)

**Goal:** Validate production-readiness, security, performance, documentation

Run 5 hardening agents in PARALLEL.

---

## AGENT 3A — SECURITY AUDITOR

You think like an attacker.

**Your ONLY job:** Find vulnerabilities before hackers do.

**Tests:**
1. **SQL Injection** → MCP tools use parameterized queries (not string concat)
2. **XSS** → All user input sanitized (React escapes by default, verify)
3. **CSRF** → MCP bridge uses secure postMessage origin validation
4. **Secrets in Logs** → No connection strings, passwords in logs
5. **Rate Limiting** → MCP server rate limits tool calls (100/min default)

**OUTPUT:**
```
VULNERABILITIES:
CRITICAL: [X] (MUST BE 0)
HIGH: [X] (MUST BE 0)
MEDIUM: [X], LOW: [X]
SECURITY_SCORE: 0-10 (MUST ≥8)
CLEARED: YES | NO
```

**DELIVERABLES:**
- Security audit report
- Vulnerability remediation log

---

## AGENT 3B — PERFORMANCE ENGINEER

You optimize for responsiveness.

**Your ONLY job:** Prove components render fast and MCP calls complete quickly.

**Benchmarks (MUST MEET):**
- Component render: <100ms (SchemaExplorer, RecommendationList)
- MCP tool call: <500ms p95 (semantic_schema_inspect)
- App bundle load: <2s on 3G
- Time to Interactive: <3s

**Tests:**
- Lighthouse audit (Performance ≥90)
- React Profiler (identify slow renders)
- Network throttling (3G simulation)
- Large dataset testing (1000+ tables)

**OUTPUT:**
```
PERFORMANCE_BENCHMARKS:
Component Render: SchemaExplorer:[X ms], RecommendationList:[X ms]
MCP Call p95: [X ms] (MUST <500ms)
Bundle Load: [X s] (MUST <2s on 3G)
Time to Interactive: [X s] (MUST <3s)
Lighthouse Score: [X/100] (MUST ≥90)
BOTTLENECKS: [list]
PERFORMANCE_SCORE: 0-10 (MUST ≥8)
```

**DELIVERABLES:**
- Performance audit report
- Lighthouse reports
- React Profiler analysis
- Optimization recommendations

---

## AGENT 3C — FINAL ACCESSIBILITY AUDIT

You are a third-party WCAG auditor.

**Your ONLY job:** Certify WCAG 2.1 AA compliance.

**Tests:**
- Screen readers (NVDA, JAWS, VoiceOver)
- Keyboard navigation (all components)
- Color contrast (automated + manual)
- Zoom to 200%
- High Contrast Mode

**Manual Testing Checklist:**
- [ ] SchemaExplorer: Tree navigation with screen reader
- [ ] RecommendationCard: Actions announced correctly
- [ ] QueryPatternList: Table structure clear to screen reader
- [ ] Modals: Focus trapped, Escape closes, focus restored
- [ ] Forms: Labels associated, errors announced

**OUTPUT:**
```
WCAG_2.1_AA: ACHIEVED | NOT_ACHIEVED
CRITICAL_VIOLATIONS: [N] (MUST BE 0)
COMPLIANCE_SCORE: 0-10 (MUST ≥9)
CLEARED: YES | NO
```

**DELIVERABLES:**
- WCAG 2.1 AA compliance certificate
- Accessibility audit report
- Screen reader test recordings
- Remediation log (if violations found)

---

## AGENT 3D — INTEGRATION TEST LEAD

You test end-to-end workflows.

**Your ONLY job:** Verify all critical workflows work in real MCP Apps environment.

**Workflows to Test:**
1. **Schema Exploration**: Open app → Connect to Teradata → Browse database → View table stats → Check drift
2. **View Recommendations**: Open app → See recommendations → View details → Dismiss recommendation
3. **Query Patterns**: Open app → View query patterns → Sort by duration → Filter by time range
4. **Error Handling**: MCP server down → Network timeout → Invalid database → Handle gracefully

**Test Environments:**
- Claude Desktop (macOS, Windows)
- Web browser (Chrome, Firefox, Safari)
- Mobile browser (iOS Safari, Chrome Android)

**OUTPUT:**
```
WORKFLOWS_TESTED: [X/4]
ENVIRONMENTS_TESTED: [X/6]
CRITICAL_FAILURES: [N] (MUST BE 0)
INTEGRATION_SCORE: 0-10 (MUST ≥8)
CLEARED: YES | NO
```

**DELIVERABLES:**
- Integration test report
- Environment compatibility matrix
- Error handling verification log

---

## AGENT 3E — DOCUMENTATION LEAD

You write docs that prevent support tickets.

**Your ONLY job:** Document everything users need to use semantic viewer.

**MUST DELIVER:**
- User Guide (with screenshots)
  - Getting Started
  - Schema Explorer Usage
  - Understanding Recommendations
  - Query Pattern Analysis
  - Keyboard Shortcuts
- API Reference (all MCP tools)
  - Tool names, descriptions, parameters, responses
  - Example calls and responses
  - Error codes and meanings
- Troubleshooting Guide
  - Common errors (MCP server not connected, database timeout)
  - How to enable mock mode
  - How to check MCP logs
- Developer Guide
  - How to add new recommendation rules
  - How to add database adapters
  - How to extend components
- Accessibility Guide
  - Keyboard shortcuts
  - Screen reader tips
  - High contrast mode

**OUTPUT:**
```
DOCUMENTATION_COMPLETE: YES | NO
DOCS_REVIEWED: YES | NO (2+ reviewers)
SCREENSHOTS: [X/Y]
DOCUMENTATION_SCORE: 0-10 (MUST ≥8)
```

**DELIVERABLES:**
- docs/USER_GUIDE.md
- docs/API_REFERENCE.md
- docs/TROUBLESHOOTING.md
- docs/DEVELOPER_GUIDE.md
- docs/ACCESSIBILITY_GUIDE.md
- docs/screenshots/ (annotated screenshots)

---

## PHASE 3 GATE

**PROCEED only if:**
```
✅ Security score ≥8 (0 critical/high)
✅ Performance score ≥8
✅ WCAG 2.1 AA certified
✅ Integration score ≥8
✅ Documentation score ≥8
✅ P0/P1 bugs = 0
```

---

# PHASE 4 — MVP LAUNCH (1-2 weeks)

**Goal:** Deploy to production, onboard beta users, collect feedback

Run 3 launch agents in PARALLEL.

---

## AGENT 4A — DEPLOYMENT LEAD

You deploy with confidence.

**Your ONLY job:** Release semantic viewer to production environments.

**Deployment Steps:**
1. Update teradata-mcp-ui package version
2. Publish to npm (if public) or internal registry
3. Update Python server with new UI resources
4. Deploy MCP server to staging
5. Smoke tests (all 3 apps load, all tools work)
6. Deploy to production
7. Monitor for errors (24 hours)

**Rollback Criteria:**
- Error rate >1%
- Any P0 bug
- User reports (>5 critical issues)

**DAILY STATUS (Week 1):**
```
DEPLOYMENT: STAGING | PRODUCTION | ROLLED_BACK
ERROR_RATE: [X%]
UPTIME: [X%]
USER_ISSUES: [N]
STATUS: STABLE | UNSTABLE
```

**DELIVERABLES:**
- Deployment checklist
- Release notes
- Rollback plan
- Monitoring dashboard

---

## AGENT 4B — USER ONBOARDING LEAD

You onboard beta users.

**Your ONLY job:** Get 10-20 beta users successfully using semantic viewer.

**Onboarding Steps:**
1. Invite beta users (Data Scientists, Data Engineers, DBAs)
2. Setup guide + demo video
3. Office hours (2x per week)
4. Feedback surveys
5. Track adoption metrics

**Success Metrics:**
- Users onboarded: 10-20
- Active users (weekly): ≥80%
- Task completion: ≥80%
- User satisfaction: ≥70/100 (SUS or CSAT)

**WEEKLY STATUS:**
```
USERS_ONBOARDED: [X/20]
ACTIVE_USERS: [X%]
TASK_COMPLETION: [X%]
SATISFACTION: [X/100]
TOP_PAIN_POINTS: [list]
CHURN_RISK: LOW | MEDIUM | HIGH
```

**DELIVERABLES:**
- Onboarding guide
- Demo video (with captions)
- Beta user feedback report
- Adoption metrics dashboard

---

## AGENT 4C — FEEDBACK COLLECTOR

You collect and triage user feedback.

**Your ONLY job:** Gather feedback, identify P0 issues, plan post-MVP roadmap.

**Feedback Channels:**
- User interviews (qualitative)
- Surveys (quantitative)
- Support tickets
- GitHub issues
- Usage analytics

**Triage:**
- P0 (blocker): Breaks critical workflow → Fix immediately
- P1 (critical): Major UX issue → Fix in hotfix
- P2 (major): Feature request (high value) → Plan for next release
- P3 (minor): Nice-to-have → Backlog

**WEEKLY STATUS:**
```
FEEDBACK_ITEMS: [N]
P0_ISSUES: [N] (MUST BE 0)
P1_ISSUES: [N]
TOP_FEATURE_REQUESTS: [list top 3]
USER_SENTIMENT: POSITIVE | NEUTRAL | NEGATIVE
```

**DELIVERABLES:**
- Feedback log (all items tracked)
- Post-MVP roadmap
- Feature prioritization matrix

---

## PHASE 4 GATE

**PROCEED only if:**
```
✅ Deployment successful
✅ 10-20 beta users onboarded
✅ Task completion ≥80%
✅ User satisfaction ≥70/100
✅ P0 bugs = 0
✅ Error rate <1%
✅ Uptime ≥99%
```

---

# FINAL VALIDATION

## AGENT FINAL — PROJECT AUDITOR

**Your ONLY job:** Certify MVP ready for GA (General Availability).

**OUTPUT:**
```
ACCEPTANCE CRITERIA: [X/Y met]

BUGS:
P0: [MUST BE 0]
P1: [MUST BE 0]
P2: [X]
P3: [X]

ACCESSIBILITY:
WCAG 2.1 AA: ACHIEVED | NOT_ACHIEVED

COVERAGE:
Unit: [X%] (≥80%)
Integration: [X%] (≥80%)

UX:
SUS: [X/100] (≥70)
Task Completion: [X%] (≥80)

PERFORMANCE:
Component Render: [X ms] (<100ms)
MCP Call p95: [X ms] (<500ms)

PRODUCTION:
Uptime: [X%] (≥99%)
Error Rate: [X%] (<1%)

DOCUMENTATION:
User Guide: COMPLETE | INCOMPLETE
API Reference: COMPLETE | INCOMPLETE

PROJECT_SCORE: 0-100

RECOMMENDATION: ACCEPT | REJECT

CONFIDENCE: HIGH | MEDIUM | LOW
```

**ACCEPT only if:**
```
✅ All criteria met
✅ P0/P1 bugs = 0
✅ WCAG 2.1 AA achieved
✅ All gates passed
✅ Score ≥80
```

---

# EXECUTION STRATEGY

## Parallel Execution

All agents in a phase run in parallel. Do NOT serialize unless dependencies exist.

## Bug Policy

P0/P1 bugs BLOCK phase completion. No exceptions. No "ship now, fix later."

## Quality Gates

- Coverage <80% → BLOCK
- WCAG not 2.1 AA → BLOCK
- Performance benchmarks not met → BLOCK

## Communication

- Daily standups (async, written status)
- Bug triage daily
- Sprint review every 2 weeks

---

# MVP SCOPE SUMMARY

## What's In MVP

✅ Schema Explorer (tree view, stats, drift indicators)
✅ Observation Layer (query patterns, schema snapshots)
✅ Recommendation Engine (3-5 rules: frequent query, missing index, schema drift)
✅ Recommendation Dashboard (list, filter, dismiss)
✅ Query Pattern Analysis (list, sort, filter)
✅ Manual execution only (no auto-mode)
✅ Teradata-first (via vantage-mcp)
✅ Database abstraction layer (ready for PostgreSQL/MySQL)

## What's Post-MVP

❌ Plan Generator (execution plans with pre/post checks)
❌ Execution Engine (safety system, rollback, auto-mode)
❌ Scheduled Jobs (cron-based execution)
❌ Reactive Triggers (event-driven execution)
❌ NL to SQL (natural language query translation)
❌ Feature Engineering (auto-generate ML features)
❌ Data Discovery (entity detection, relationship inference)
❌ Anomaly Detection (continuous monitoring)

---

# DATABASE COMPATIBILITY MATRIX

| Feature | Teradata | PostgreSQL | MySQL | Generic SQL |
|---------|----------|------------|-------|-------------|
| **Schema Inspection** | DBC.ColumnsV | information_schema.columns | information_schema.columns | ✅ Abstraction ready |
| **Table Statistics** | DBC.TablesV | pg_stat_user_tables | information_schema.tables | ✅ Abstraction ready |
| **Query Plan** | EXPLAIN | EXPLAIN ANALYZE | EXPLAIN | ✅ Format differs |
| **Query Cost** | DBQL EstTotalTime | pg_stat_statements.total_time | N/A | ⚠️ Teradata-only for now |
| **Materialized View** | CREATE JOIN INDEX | CREATE MATERIALIZED VIEW | CREATE TABLE AS (workaround) | ❌ Requires adapter |
| **Index Creation** | CREATE INDEX | CREATE INDEX | CREATE INDEX | ✅ Standard SQL |
| **Statistics Collection** | COLLECT STATISTICS | ANALYZE | ANALYZE TABLE | ❌ Requires adapter |

**Legend:**
✅ = Works across all databases with abstraction
⚠️ = Teradata-specific, others stubbed
❌ = Requires database-specific adapter

---

# TERADATA-SPECIFIC FEATURES

## Critical Differences

1. **Materialized Views = JOIN INDEX**
   - Teradata: `CREATE JOIN INDEX mv_name AS SELECT ... PRIMARY INDEX (...);`
   - PostgreSQL: `CREATE MATERIALIZED VIEW mv_name AS SELECT ...;`
   - MySQL: No native support, use `CREATE TABLE AS`

2. **Statistics Collection**
   - Teradata: `COLLECT STATISTICS ON table_name (column_name);`
   - PostgreSQL: `ANALYZE table_name;`
   - MySQL: `ANALYZE TABLE table_name;`

3. **Query Cost Estimation**
   - Teradata: Uses DBQL (Database Query Log) for actual costs
   - PostgreSQL: Uses pg_stat_statements for estimates
   - MySQL: No built-in query cost tracking

4. **Schema Metadata**
   - Teradata: DBC (Data Dictionary) views (DBC.ColumnsV, DBC.TablesV, DBC.IndicesV)
   - PostgreSQL: information_schema + pg_catalog
   - MySQL: information_schema

## Recommendation Rules Compatibility

| Rule Type | Teradata | PostgreSQL | MySQL |
|-----------|----------|------------|-------|
| **Frequent Query → Materialized View** | JOIN INDEX | MATERIALIZED VIEW | TABLE (workaround) |
| **Missing Index → Add Index** | ✅ Standard | ✅ Standard | ✅ Standard |
| **Schema Drift → Alert** | ✅ Via DBC | ✅ Via information_schema | ✅ Via information_schema |
| **Slow Query → Optimize** | ✅ Via DBQL | ✅ Via pg_stat | ⚠️ Limited support |
| **Data Skew → Rebalance** | ✅ Teradata-specific | ❌ N/A | ❌ N/A |

---

# SUCCESS METRICS (MVP)

## Technical Metrics

- **Test Coverage:** ≥80% (frontend + backend)
- **WCAG Compliance:** 2.1 AA (0 critical violations)
- **Performance:** Component render <100ms, MCP calls <500ms p95
- **Bundle Size:** <500KB gzipped per app
- **Uptime:** ≥99% (production)
- **Error Rate:** <1% (production)

## User Metrics

- **Task Completion:** ≥80% (schema exploration, view recommendations)
- **User Satisfaction:** ≥70/100 (SUS score)
- **Beta Users:** 10-20 onboarded
- **Active Users:** ≥80% weekly active rate

## Qualitative Metrics

- **Pain Points Addressed:** Validated through user interviews
- **Feature Requests:** Tracked for post-MVP roadmap
- **Support Tickets:** <5 critical issues per week

---

# RISKS & MITIGATIONS

## High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **vantage-mcp changes breaking integration** | HIGH | Pin vantage-mcp version, mock mode for development |
| **Teradata-specific features limit portability** | MEDIUM | Database abstraction layer, feature flags |
| **Bundle size exceeds 500KB** | MEDIUM | Code splitting, lazy loading, tree shaking |
| **WCAG 2.1 AA not achieved** | HIGH | A11y testing from Day 1, dedicated A11y agent |
| **User adoption low** | HIGH | UX research Phase 0, beta testing Phase 4 |

## Medium-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| **MCP protocol changes** | MEDIUM | Monitor MCP spec changes, version pinning |
| **Performance issues with large datasets** | MEDIUM | Pagination, virtualization, query optimization |
| **Mock data doesn't match real data** | LOW | Validate mock data with real Teradata queries |

---

# DEPENDENCIES

## External Dependencies

### vantage-mcp (Go Repository)

**Location:** `~/repos/vantage-mcp` (sibling repository)
**Build Requirements:**
- Go 1.25.0+
- `justfile` (build automation) OR standard `go build`
- `buf` (for protobuf code generation)

**Runtime Requirements:**
- vantage-mcp binary compiled (`~/repos/vantage-mcp/bin/vantage-mcp`)
- Environment variables set:
  - `TD_USER` - Teradata username
  - `TD_PASSWORD` - Teradata password
  - `TD_DEFAULT_HOST` - Teradata host
  - `TD_LOGMECH` (optional) - Login mechanism
  - `MCP_APPS_DIR` (optional) - Path to HTML app bundles

**Build Steps:**
```bash
cd ~/repos/vantage-mcp
just build                    # Builds to ./bin/vantage-mcp
# OR
go build ./cmd/vantage-mcp    # Builds to ./vantage-mcp
```

**Test vantage-mcp:**
```bash
cd ~/repos/vantage-mcp
just test                     # Run unit tests
just test-coverage            # Run with coverage
```

**Integration Test:**
```bash
export TD_USER="dbc"
export TD_PASSWORD="dbc"
export TD_DEFAULT_HOST="localhost"
export MCP_APPS_DIR="$HOME/repos/teradata-mcp-ui/packages/components/dist/apps"

~/repos/vantage-mcp/bin/vantage-mcp
# Should start without errors
# Test with JSON-RPC request to tools/call
```

### Teradata Vantage

- **Database:** Teradata Vantage instance accessible from development machine
- **Credentials:** Valid TD_USER/TD_PASSWORD with appropriate privileges
- **Network:** Database must be reachable (firewall rules, VPN)

### MCP Apps

- **Claude Desktop** or compatible MCP host
- **MCP Protocol:** 2024-11-05 support

## Internal Dependencies

### Phase Dependencies

- **Phase 0 → Phase 1:**
  - vantage-mcp must be built and tested
  - Teradata connection verified
  - Database compatibility matrix complete

- **Phase 1 → Phase 2:**
  - vantage-mcp stdio proxy implemented in Python
  - MCP tools must be implemented before React components
  - Observation data model deployed to SQLite

- **Phase 2 → Phase 3:**
  - Components must be complete before hardening
  - HTML app bundles built and discoverable by vantage-mcp

- **Phase 3 → Phase 4:**
  - Security/performance/A11y must pass before launch
  - vantage-mcp integration tests passing

### Repository Dependencies

```
teradata-mcp-ui (this repo)
    ↓ (runtime: spawns as subprocess)
vantage-mcp (~/repos/vantage-mcp)
    ↓ (build-time: Go module replace)
teradatacli (~/repos/teradatacli or ../teradatacli)
    ↓ (runtime: connects via BTEQ)
Teradata Vantage (database)
```

**Critical:** All three repositories (teradata-mcp-ui, vantage-mcp, teradatacli) must be cloned as sibling directories for Go module resolution to work.

---

# TIMELINE SUMMARY

| Phase | Duration | Critical Path |
|-------|----------|---------------|
| **Phase 0:** Requirements & Validation | 2 days | User interviews, database compatibility |
| **Phase 1:** MCP Tools & Data Model | 3 weeks | Observation layer, MCP tools, abstraction layer |
| **Phase 2:** React Components & Integration | 4 weeks | All 5 component groups + MCP Apps |
| **Phase 3:** Production Hardening | 2 weeks | Security, performance, A11y audits |
| **Phase 4:** MVP Launch | 1-2 weeks | Deployment, beta testing |
| **TOTAL** | **12-13 weeks** | |

---

**STATUS:** AWAITING APPROVAL

**Next Steps:**
1. Review plan with stakeholders
2. Secure resources (1-2 engineers, access to Teradata instance)
3. Begin Phase 0 with 5 parallel agents
4. Iterate based on Phase 0 findings

---

---

# INTEGRATION VALIDATION CHECKLIST

## Pre-Phase 0 Setup

### vantage-mcp Setup
- [ ] Clone vantage-mcp repository to `~/repos/vantage-mcp`
- [ ] Install Go 1.25.0+
- [ ] Install `justfile` or use `go build` directly
- [ ] Build vantage-mcp: `cd ~/repos/vantage-mcp && just build`
- [ ] Verify binary exists: `~/repos/vantage-mcp/bin/vantage-mcp`
- [ ] Run vantage-mcp tests: `just test`
- [ ] Verify 100% MCP protocol coverage, 77%+ transport coverage

### Teradata Connection
- [ ] Set environment variables:
  - `export TD_USER="your_username"`
  - `export TD_PASSWORD="your_password"`
  - `export TD_DEFAULT_HOST="your_teradata_host"`
- [ ] Test connection manually:
  ```bash
  ~/repos/vantage-mcp/bin/vantage-mcp
  # Send JSON-RPC request via stdin
  ```
- [ ] Verify lazy connection initializes on first tool call
- [ ] Observe ~2-3s delay on first query (expected)

### teradata-mcp-ui Setup
- [ ] Build React components: `pnpm build`
- [ ] Build HTML app bundles: `pnpm --filter @teradata-mcp-ui/components build:apps`
- [ ] Verify bundles exist: `packages/components/dist/apps/*.html`
- [ ] Set `MCP_APPS_DIR`: `export MCP_APPS_DIR="$HOME/repos/teradata-mcp-ui/packages/components/dist/apps"`
- [ ] Verify vantage-mcp discovers apps (check resource list)

### Repository Structure
- [ ] Verify sibling directory layout:
  ```
  ~/repos/
  ├── teradata-mcp-ui/
  ├── vantage-mcp/
  └── teradatacli/        # (if using local override)
  ```

## Phase 0 Validation

- [ ] vantage-mcp `teradata_execute_sql` tool works
- [ ] vantage-mcp `get_last_result` tool works
- [ ] vantage-mcp serves HTML resources (resource/list, resource/read)
- [ ] Python server can spawn vantage-mcp subprocess
- [ ] Python server can send JSON-RPC requests to vantage-mcp
- [ ] Error handling returns structured Teradata errors
- [ ] Database compatibility matrix complete

## Phase 1 Validation

- [ ] Python stdio proxy to vantage-mcp working
- [ ] All 12-15 semantic tools implemented in Python
- [ ] Mock mode working (no vantage-mcp required)
- [ ] Real mode proxies to vantage-mcp stdio
- [ ] Observation data stored in SQLite
- [ ] Database abstraction layer tested (Teradata + 1 other DB)

## Phase 2 Validation

- [ ] React components use `useMcpTool()` hook (no direct APIs)
- [ ] All 5 component groups complete
- [ ] HTML app bundles <500KB gzipped
- [ ] vantage-mcp discovers and serves new HTML apps
- [ ] Integration tests pass (MCP bridge → Python → vantage-mcp → Teradata)
- [ ] 80% test coverage (frontend + backend)
- [ ] WCAG 2.1 AA compliance (0 critical violations)

## Phase 3 Validation

- [ ] Security audit passed (0 critical/high vulnerabilities)
- [ ] Performance benchmarks met (<100ms component render, <500ms MCP calls)
- [ ] Accessibility certified (WCAG 2.1 AA)
- [ ] Integration tests passing in Claude Desktop
- [ ] Documentation complete

## Phase 4 Validation

- [ ] Deployment successful
- [ ] 10-20 beta users onboarded
- [ ] Task completion ≥80%
- [ ] User satisfaction ≥70/100
- [ ] P0 bugs = 0
- [ ] Error rate <1%
- [ ] Uptime ≥99%

---

**Plan Version:** 1.0
**Created:** 2026-02-09
**Updated:** 2026-02-09 (Added vantage-mcp Go integration details)
**Template:** AGENT-EXECUTION-TEMPLATE-FOR-AGENTS v1.0
**Optimized For:** Teradata-first, database-agnostic design
**Quality Policy:** P0/P1 bugs BLOCK all gates
**Integration:** vantage-mcp (Go) + teradata-mcp-ui (Python/React)
