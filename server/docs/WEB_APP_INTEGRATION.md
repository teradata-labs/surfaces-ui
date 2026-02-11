# Using SQL Editor in a Web Application

## Overview

Yes! You can use the SQL Editor component in a standard web application. Here's how.

## Three Integration Options

### Option 1: HTTP Bridge (Recommended for Web Apps)

Use the pre-built web app version that connects to your REST API.

**File:** `packages/components/src/apps/sql-editor-webapp.tsx`
**URL:** http://localhost:3000/sql-editor-webapp

This version includes an `HttpBridge` that makes standard HTTP requests to your backend API instead of using MCP protocol.

### Option 2: Embed the React Component

Import the `SQLEditor` component directly into your React app.

### Option 3: Use as Iframe

Embed the built HTML app in an iframe in any web page.

---

## Option 1: HTTP Bridge (Full Example)

### Backend API Requirements

Your backend needs a single endpoint:

```
POST /api/sql/execute
Content-Type: application/json

Request Body:
{
  "query": "SELECT * FROM users LIMIT 10",
  "connection_id": "optional-connection-id"
}

Response:
{
  "success": true,
  "columns": ["id", "name", "email"],
  "data": [
    {"id": 1, "name": "Alice", "email": "alice@example.com"},
    {"id": 2, "name": "Bob", "email": "bob@example.com"}
  ],
  "row_count": 2
}

Error Response:
{
  "success": false,
  "error": "Syntax error at line 1: unexpected token 'SELEC'"
}
```

### Python (Flask) Example

```python
from flask import Flask, request, jsonify
import psycopg2  # or your DB library

app = Flask(__name__)

@app.route('/api/sql/execute', methods=['POST'])
def execute_sql():
    data = request.json
    query = data.get('query')
    connection_id = data.get('connection_id')

    try:
        # Execute query against your database
        conn = get_db_connection(connection_id)
        cursor = conn.cursor()
        cursor.execute(query)

        # Fetch results
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()

        # Convert to dict format
        data = [dict(zip(columns, row)) for row in rows]

        return jsonify({
            "success": True,
            "columns": columns,
            "data": data,
            "row_count": len(data)
        })

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400
```

### Node.js (Express) Example

```javascript
const express = require('express');
const { Pool } = require('pg');  // or your DB library

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.post('/api/sql/execute', async (req, res) => {
  const { query, connection_id } = req.body;

  try {
    const result = await pool.query(query);

    const columns = result.fields.map(f => f.name);
    const data = result.rows;

    res.json({
      success: true,
      columns,
      data,
      row_count: data.length
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3001, () => console.log('API running on port 3001'));
```

### Go (Gin) Example

```go
package main

import (
    "database/sql"
    "github.com/gin-gonic/gin"
    _ "github.com/lib/pq"
)

type ExecuteRequest struct {
    Query        string `json:"query"`
    ConnectionID string `json:"connection_id"`
}

type ExecuteResponse struct {
    Success  bool                     `json:"success"`
    Columns  []string                 `json:"columns,omitempty"`
    Data     []map[string]interface{} `json:"data,omitempty"`
    RowCount int                      `json:"row_count,omitempty"`
    Error    string                   `json:"error,omitempty"`
}

func executeSQL(c *gin.Context) {
    var req ExecuteRequest
    if err := c.BindJSON(&req); err != nil {
        c.JSON(400, ExecuteResponse{Success: false, Error: err.Error()})
        return
    }

    db, _ := sql.Open("postgres", "connection-string")
    rows, err := db.Query(req.Query)
    if err != nil {
        c.JSON(400, ExecuteResponse{Success: false, Error: err.Error()})
        return
    }
    defer rows.Close()

    columns, _ := rows.Columns()
    var data []map[string]interface{}

    for rows.Next() {
        values := make([]interface{}, len(columns))
        valuePtrs := make([]interface{}, len(columns))
        for i := range values {
            valuePtrs[i] = &values[i]
        }

        rows.Scan(valuePtrs...)

        row := make(map[string]interface{})
        for i, col := range columns {
            row[col] = values[i]
        }
        data = append(data, row)
    }

    c.JSON(200, ExecuteResponse{
        Success:  true,
        Columns:  columns,
        Data:     data,
        RowCount: len(data),
    })
}

func main() {
    r := gin.Default()
    r.POST("/api/sql/execute", executeSQL)
    r.Run(":3001")
}
```

### Configure API URL

In your HTML file:
```html
<script>
  // Point to your API
  window.__API_BASE_URL__ = 'https://your-api.example.com/api';
  // or for local dev:
  // window.__API_BASE_URL__ = '/api';
</script>
```

### CORS Configuration

Your backend must allow CORS if frontend and backend are on different domains:

```python
# Python Flask
from flask_cors import CORS
CORS(app)
```

```javascript
// Node.js Express
const cors = require('cors');
app.use(cors());
```

---

## Option 2: Embed React Component

### Install Package

```bash
npm install @surfaces-ui/components
```

### Create Custom Bridge

```typescript
// src/bridge/HttpSqlBridge.ts
export class HttpSqlBridge {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (name === 'execute_sql') {
      const response = await fetch(`${this.apiUrl}/sql/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });

      const result = await response.json();
      return { success: result.success, data: result };
    }

    throw new Error(`Unknown tool: ${name}`);
  }

  // Implement other required methods...
  connect() {}
  disconnect() {}
  get isConnected() { return true; }
  onDataPush() { return () => {}; }
  // etc.
}
```

### Use in Your App

```tsx
// src/App.tsx
import { McpBridgeProvider } from '@surfaces-ui/components';
import { SQLEditor } from '@surfaces-ui/components';
import { HttpSqlBridge } from './bridge/HttpSqlBridge';
import '@surfaces-ui/components/theme/tokens.css';

const bridge = new HttpSqlBridge('https://your-api.example.com/api');

function App() {
  return (
    <McpBridgeProvider bridge={bridge}>
      <SQLEditor
        title="SQL Query Editor"
        initialCode="SELECT * FROM users LIMIT 10"
        context="web"
      />
    </McpBridgeProvider>
  );
}
```

---

## Option 3: Iframe Embed

### Build the App

```bash
cd packages/components
pnpm build:http
```

### Serve via Your Backend

Copy `dist/http/sql-editor-webapp.html` and `dist/http/assets/*` to your web server.

### Embed in Any Page

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Application</title>
</head>
<body>
  <h1>Database Query Tool</h1>

  <!-- Embed SQL Editor -->
  <iframe
    src="https://your-app.com/sql-editor-webapp.html"
    width="100%"
    height="600px"
    frameborder="0"
  ></iframe>
</body>
</html>
```

---

## Security Considerations

### 1. Authentication

Add authentication to your API:

```python
from flask import request
from functools import wraps

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not verify_token(token):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/sql/execute', methods=['POST'])
@require_auth
def execute_sql():
    # ...
```

Pass token from frontend:

```typescript
async callTool(name: string, args: Record<string, unknown>) {
  const response = await fetch(`${this.apiUrl}/sql/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(args),
  });
  // ...
}
```

### 2. SQL Injection Protection

**Never** execute raw SQL directly. Use parameterized queries:

```python
# BAD - SQL Injection vulnerable
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# GOOD - Safe
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
```

### 3. Query Validation

Whitelist allowed operations:

```python
def is_safe_query(query):
    query_lower = query.lower().strip()

    # Only allow SELECT
    if not query_lower.startswith('select'):
        return False, "Only SELECT queries are allowed"

    # Block dangerous keywords
    dangerous = ['drop', 'delete', 'truncate', 'alter', 'create']
    for keyword in dangerous:
        if keyword in query_lower:
            return False, f"Keyword '{keyword}' not allowed"

    return True, None

@app.route('/api/sql/execute', methods=['POST'])
def execute_sql():
    query = request.json.get('query')

    safe, error = is_safe_query(query)
    if not safe:
        return jsonify({"success": False, "error": error}), 400

    # ... execute query
```

### 4. Rate Limiting

```python
from flask_limiter import Limiter

limiter = Limiter(app, key_func=lambda: request.remote_addr)

@app.route('/api/sql/execute', methods=['POST'])
@limiter.limit("10 per minute")
def execute_sql():
    # ...
```

### 5. Result Size Limits

```python
@app.route('/api/sql/execute', methods=['POST'])
def execute_sql():
    query = request.json.get('query')

    # Add LIMIT if not present
    if 'limit' not in query.lower():
        query += ' LIMIT 1000'

    # Execute with timeout
    cursor.execute(query)
    cursor.execute("SET statement_timeout = 30000")  # 30 seconds

    # ...
```

---

## Deployment Checklist

- [ ] Backend API endpoint implemented
- [ ] CORS configured correctly
- [ ] Authentication added
- [ ] SQL injection protection in place
- [ ] Query validation (whitelist SELECT)
- [ ] Rate limiting configured
- [ ] Result size limits enforced
- [ ] Query timeouts set
- [ ] Error messages sanitized (don't leak DB structure)
- [ ] HTTPS enabled in production
- [ ] Logging and monitoring configured

---

## Example Full Stack Setup

### Frontend: Vite + React
```
your-app/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json (includes @surfaces-ui/components)
```

### Backend: Express + PostgreSQL
```
your-app/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── sql.ts
│   │   └── server.ts
│   └── package.json
```

### Deploy
```
Frontend: Vercel/Netlify (static hosting)
Backend: Heroku/Railway/AWS (with PostgreSQL)
```

---

## Differences from MCP Version

| Feature | MCP Version | Web App Version |
|---------|-------------|-----------------|
| Protocol | MCP (JSON-RPC) | REST API (HTTP) |
| Communication | via Claude Desktop | Direct HTTP |
| Backend | stdio subprocess | HTTP server |
| Use Case | Claude Desktop integration | Standalone web app |
| Authentication | Handled by Claude | Your auth system |
| Deployment | With Claude | Any web host |

---

## Summary

**Yes, you can use the SQL Editor in a web app!**

**Easiest way:**
1. Build the webapp version: `pnpm build:http`
2. Create REST API endpoint: `POST /api/sql/execute`
3. Configure API URL in the HTML
4. Deploy both frontend and backend

The component is designed to work with different bridge implementations, so you can easily adapt it to your architecture.

See `sql-editor-webapp.tsx` for a complete working example! 🎯
