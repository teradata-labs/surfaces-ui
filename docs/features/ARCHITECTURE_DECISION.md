# Architecture Decision: UI Server Strategy

## Context

Monaco Editor requires HTTP server for web workers. We need to decide where this HTTP serving capability should live.

## Options Considered

### Option 1: Add HTTP Server to vantage-mcp (Go)

**Architecture:**
```
┌─────────────────────────────────┐
│ vantage-mcp (Single Process)    │
│  ├─ MCP Protocol (stdio)        │
│  │   └─ Tools: execute_sql      │
│  └─ HTTP Server (Go)             │
│      └─ Serves UI apps           │
└─────────────────────────────────┘
```

**Pros:**
- Single process for desktop users
- Simpler deployment for Claude Desktop
- No port coordination needed
- Go's stdlib HTTP server is efficient

**Cons:**
- **Mixes concerns**: Database + UI serving in same binary
- **Tight coupling**: UI updates require vantage-mcp rebuild/release
- **Can't scale independently**: UI traffic affects DB connection pool
- **Wrong tool**: Go better for low-level DB work than asset serving
- **Development friction**: Frontend changes need Go rebuild

**Scaling Grade: C-**
- Development: Poor (tight coupling)
- Deployment: Poor (coupled releases)
- Runtime: Poor (can't scale separately)
- Operations: Good (single process)

---

### Option 2: Separate HTTP Server (surfaces-ui)

**Architecture:**
```
┌──────────────────┐
│ Claude Desktop   │
└────────┬─────────┘
         │ MCP stdio
         ▼
┌─────────────────────────┐    HTTP    ┌──────────────────────────┐
│ vantage-mcp (Go)        │◄──────────▶│ surfaces-ui (Python) │
│ - execute_sql tool      │            │ - HTTP Server (FastAPI)  │
│ - MCP protocol only     │            │ - Serves UI apps         │
│ - Points to UI_SERVER   │            │ - Middleware (auth, etc) │
└─────────────────────────┘            └──────────────────────────┘
      │ stdio                                    │ HTTP :3000
      └──────────────────────────────────────────┘
```

**Pros:**
- **Separation of concerns**: Each service does one thing well
- **Independent releases**: UI updates don't touch vantage-mcp
- **Independent scaling**: Scale UI horizontally under load
- **Technology fit**: Python/FastAPI excellent for web serving
- **Future-proof**: Can add auth, rate limiting, caching to UI layer
- **Multi-tenancy ready**: Multiple UI servers share vantage-mcp backend

**Cons:**
- Two processes to manage (desktop scenario)
- Port coordination needed
- Slightly more complex config

**Scaling Grade: A**
- Development: Excellent (independent teams)
- Deployment: Excellent (independent releases)
- Runtime: Excellent (horizontal scaling)
- Operations: Good (worth the complexity)

---

### Option 3: Third Repository (Separate UI Server Repo)

**Architecture:**
```
teradata/
├─ vantage-mcp/          (Go - MCP + DB)
├─ surfaces-ui/      (React components library)
└─ surfacesui-server/    (Python/Node - HTTP server)
```

**Pros:**
- Complete independence
- Could use any language/framework
- Clear ownership boundaries

**Cons:**
- **Overhead**: Managing third repo
- **Duplication**: React components already in surfaces-ui
- **Packaging complexity**: Need to publish/consume components
- **Version coordination**: Three repos to align
- **No clear benefit**: Over Option 2

**Scaling Grade: B**
- Development: Good (but overhead)
- Deployment: Good (but complex)
- Runtime: Excellent (same as Option 2)
- Operations: Poor (three repos)

---

## Recommendation: Option 2 (Separate HTTP Server in Current Repo)

### Architecture: Microservices with Clean Separation

**Desktop Deployment:**
```
Laptop (localhost)
├─ vantage-mcp :stdio
└─ surfaces-ui :3000
```

**Production Deployment:**
```
┌─────────────────────────────────┐
│ Load Balancer                    │
│ https://surfaces-ui.company.com │
└──────────┬──────────────────────┘
           │
    ┏──────┴──────┐
    ▼             ▼
┌─────────┐  ┌─────────┐
│ UI Srv1 │  │ UI Srv2 │  ← Scale horizontally
└────┬────┘  └────┬────┘
     │            │
     └─────┬──────┘
           ▼
    ┌─────────────┐
    │ vantage-mcp │  ← Internal only
    └─────────────┘
```

### Why This Scales Best

#### 1. **Development Scaling**
- **UI Team**: Updates React components, rebuilds, deploys UI server
- **Backend Team**: Updates SQL tools, rebuilds vantage-mcp
- **No coordination needed**: Independent release cycles
- **Fast iteration**: UI changes deploy in seconds, not minutes

#### 2. **Deployment Scaling**
- **Zero-downtime UI updates**: Rolling deployment of UI servers
- **Backend stability**: vantage-mcp connections uninterrupted
- **A/B testing**: Run multiple UI versions simultaneously
- **Rollback**: Independent rollback of each layer

#### 3. **Runtime Scaling**
- **Horizontal UI scaling**: Add UI servers under load
- **Resource isolation**: UI traffic doesn't impact DB connections
- **Caching layer**: Add Redis/CDN in front of UI server
- **Geographic distribution**: UI servers in multiple regions

#### 4. **Operational Scaling**
- **Monitoring**: Separate metrics per service
- **Security**: UI server in DMZ, vantage-mcp internal
- **Authentication**: Add auth middleware to UI server only
- **Rate limiting**: Protect backend from UI layer

### Technology Appropriateness

| Concern | Best Tool | Rationale |
|---------|-----------|-----------|
| Database connections | **Go** (vantage-mcp) | Low-level, efficient, compiled |
| SQL execution | **Go** (vantage-mcp) | Direct tdcli bindings |
| MCP protocol | **Go** (vantage-mcp) | stdio communication |
| HTTP serving | **Python/FastAPI** | Middleware, routing, async |
| Static assets | **Python/FastAPI** | Built-in static files |
| WebSocket (future) | **Python/FastAPI** | Easy async support |
| Authentication | **Python/FastAPI** | Rich ecosystem |

### Configuration Strategy

**Claude Desktop (simple):**
```json
{
  "mcpServers": {
    "vantage-mcp": {
      "env": {
        "UI_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Production (scalable):**
```json
{
  "mcpServers": {
    "vantage-mcp": {
      "env": {
        "UI_SERVER_URL": "https://surfaces-ui.company.com"
      }
    }
  }
}
```

### Implementation Plan

1. **vantage-mcp changes:**
   - Add `UI_SERVER_URL` env variable
   - MCP resources return URLs like `${UI_SERVER_URL}/sql-editor`
   - No HTTP server in vantage-mcp

2. **surfaces-ui changes:**
   - Already has HTTP server (FastMCP)
   - Already serves dist/http/
   - Just needs to run alongside vantage-mcp

3. **Desktop usage:**
   - Start both processes (can be automated with shell script)
   - Or: Claude Desktop starts both via config

4. **Production usage:**
   - Deploy UI server as web service (docker/k8s)
   - vantage-mcp as internal service
   - Scale each independently

---

## Decision Matrix

| Criteria | Option 1 (Go HTTP) | Option 2 (Separate) | Option 3 (3rd Repo) |
|----------|-------------------|---------------------|---------------------|
| Development Velocity | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Independent Releases | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Horizontal Scaling | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Operational Simplicity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Technology Fit | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Future Features | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Total** | **14/30** | **28/30** | **23/30** |

---

## Conclusion

**Recommendation: Option 2 - Separate HTTP Server in surfaces-ui**

Keep two repos:
- **vantage-mcp**: MCP protocol + SQL execution (Go)
- **surfaces-ui**: React components + HTTP server (Python)

This follows microservices principles, scales in all dimensions, and uses each technology where it excels.

**For desktop users**: Simple enough (two localhost processes)
**For production**: Industrial-grade scalability

---

## References

- Microservices Architecture: https://microservices.io/
- The Twelve-Factor App: https://12factor.net/
- Conway's Law: System design mirrors team communication structure
