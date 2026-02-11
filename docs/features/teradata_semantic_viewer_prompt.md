# Teradata Semantic Viewer - Claude Code Build Prompt

## Project Overview

Build a **Teradata Semantic Viewer** - an MCP-UI chat application that acts as an intelligent database automation platform. This system observes database usage patterns, recommends optimization jobs, and can execute them automatically or with approval across multiple execution modes.

## Core Value Proposition

Transform database management from reactive manual work to proactive autonomous optimization:
- **For Data Scientists**: Automated feature engineering, smart caching, and ML-ready datasets
- **For Business Analysts**: Natural language queries, automated pipelines, and self-service contexts
- **For Data Engineers**: Proactive performance optimization, quality monitoring, and cost management
- **For Admins**: Automated governance, access control, and compliance

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│     MCP-UI Chat Interface (React/TypeScript)             │
│  • Schema Browser & Drift Detector                       │
│  • Recommendation Dashboard                              │
│  • Execution Plan Viewer                                 │
│  • Job Status Monitor                                    │
└─────────────────────────────────────────────────────────┘
                         ↕ MCP Protocol
┌─────────────────────────────────────────────────────────┐
│    Semantic Viewer MCP Server (Go preferred, or Python) │
│  • Observation Layer (pattern detection)                │
│  • Recommendation Engine (rule + ML based)              │
│  • Plan Generator & Executor                            │
│  • Governance & Safety System                           │
└─────────────────────────────────────────────────────────┘
                         ↕
                  Teradata Database
```

## Phase 1: Foundation (Start Here)

### 1.1 MCP Server Scaffold

**Goal**: Create a working MCP server that can connect to Teradata and expose basic tools.

**Requirements**:
- Language: Go (preferred, matches Loom framework) or Python
- Must implement MCP protocol correctly
- Connect to Teradata using appropriate driver:
  - Go: `github.com/Teradata/teradata-go-driver`
  - Python: `teradatasql`
- Configuration via environment variables or config file

**Initial MCP Tools** (implement these first):

```typescript
// Tool 1: Basic query execution
{
  name: "semantic_query",
  description: "Execute SQL query with optional semantic context",
  inputSchema: {
    query: "string",           // SQL query
    context_id: "string?",      // Optional context to apply
    format: "table|json|csv",   // Output format
    max_rows: "number?"         // Limit results
  }
}

// Tool 2: Schema inspection
{
  name: "schema_inspect",
  description: "Get detailed schema information for tables/databases",
  inputSchema: {
    database: "string?",
    table: "string?",
    include_stats: "boolean?"   // Row counts, sizes, etc.
  }
}

// Tool 3: List recommendations (stub for now)
{
  name: "recommendations_list",
  description: "Get active optimization recommendations",
  inputSchema: {
    category: "performance|quality|cost|all",
    priority: "high|medium|low|all",
    limit: "number?"
  }
}
```

**Deliverables**:
- Working MCP server that starts successfully
- Can connect to Teradata (use connection string from env)
- Returns valid responses for all three tools
- Basic error handling and logging
- README with setup instructions

**File Structure**:
```
teradata-semantic-viewer/
├── mcp-server/
│   ├── main.go (or main.py)
│   ├── config/
│   │   └── config.go
│   ├── database/
│   │   └── teradata.go
│   ├── tools/
│   │   ├── query.go
│   │   ├── schema.go
│   │   └── recommendations.go
│   ├── go.mod
│   └── README.md
├── mcp-ui/
│   └── (Phase 2)
└── docs/
    └── architecture.md
```

**Testing**:
- Can execute basic SELECT queries
- Can retrieve schema for a known table
- Handles connection errors gracefully
- Returns properly formatted MCP responses

---

### 1.2 Observation Layer

**Goal**: Implement passive monitoring that collects usage patterns.

**Components**:

1. **Query Pattern Tracker**
```go
type QueryPattern struct {
    QueryHash     string    // Normalized query signature
    ExecutionCount int
    AvgDuration   float64
    TotalCost     float64
    LastSeen      time.Time
    Users         []string
    Tables        []string
}

// Track every query execution
func RecordQueryExecution(query string, duration time.Duration, user string)
```

2. **Schema Change Detector**
```go
type SchemaSnapshot struct {
    Database   string
    Table      string
    Columns    []ColumnInfo
    Timestamp  time.Time
    Checksum   string
}

// Compare snapshots to detect drift
func DetectSchemaDrift(before, after SchemaSnapshot) []SchemaChange
```

3. **Performance Metrics Collector**
```go
type PerformanceMetrics struct {
    QueryID       string
    Duration      float64
    RowsScanned   int64
    RowsReturned  int64
    CPUTime       float64
    IOCost        float64
    Timestamp     time.Time
}
```

**Storage**:
- Use SQLite or embedded database (bbolt, badger) for local storage
- Schema:
  - `query_patterns` table
  - `schema_snapshots` table
  - `performance_metrics` table
  - `observations` table (generic event log)

**MCP Tools to Add**:
```typescript
{
  name: "observations_query",
  description: "Query collected observations and patterns",
  inputSchema: {
    type: "query_pattern|schema_change|performance",
    filters: "object?",
    time_range: "object?"
  }
}
```

**Deliverables**:
- Observation system running alongside query execution
- Data persisted to local database
- Can query observations via MCP tool
- Automated schema snapshot taken daily (configurable)

---

### 1.3 Basic Recommendation Engine

**Goal**: Generate simple rule-based recommendations.

**Rule Types to Implement**:

1. **Frequent Query → Materialized View**
```go
type RecommendationRule interface {
    Evaluate(observations []Observation) []Recommendation
    Score(rec Recommendation) (float64, float64) // score, confidence
}

type FrequentQueryRule struct {
    Threshold int  // Min executions per day
    DurationThreshold float64 // Min avg duration in seconds
}

func (r *FrequentQueryRule) Evaluate(obs []Observation) []Recommendation {
    // If query runs >Threshold times with >DurationThreshold seconds
    // Recommend: Create materialized view
}
```

2. **Missing Index → Add Index**
```go
type MissingIndexRule struct {
    ScanThreshold int64  // Min rows scanned
}

func (r *MissingIndexRule) Evaluate(obs []Observation) []Recommendation {
    // If table scan on large table in WHERE/JOIN clause
    // Recommend: Add index on frequently filtered columns
}
```

3. **Schema Drift → Alert**
```go
type SchemaDriftRule struct {}

func (r *SchemaDriftRule) Evaluate(obs []Observation) []Recommendation {
    // If schema changed without documentation
    // Recommend: Review and document changes
}
```

**Recommendation Structure**:
```go
type Recommendation struct {
    ID          string
    Type        string  // "performance", "quality", "cost", "compliance"
    Priority    string  // "high", "medium", "low"
    Title       string
    Description string
    
    // Scoring
    Score       float64  // 0-100
    Confidence  float64  // 0-1
    
    // Impact estimation
    EstimatedImpact struct {
        TimeSaved   string
        CostSaved   string
        UsersAffected int
        QueriesAffected int
    }
    
    // Action details
    ProposedAction struct {
        Type     string  // "create_table", "add_index", etc.
        SQL      string
        Steps    []string
    }
    
    RollbackPlan string
    ApprovalNeeded bool
    
    CreatedAt time.Time
    Status    string  // "active", "dismissed", "approved", "executed"
}
```

**MCP Tools to Update**:
```typescript
{
  name: "recommendations_list",
  description: "Get active optimization recommendations",
  inputSchema: {
    category: "performance|quality|cost|compliance|all",
    priority: "high|medium|low|all",
    limit: "number?",
    sort_by: "score|priority|created_at"
  }
}

{
  name: "recommendation_dismiss",
  description: "Dismiss or snooze a recommendation",
  inputSchema: {
    recommendation_id: "string",
    action: "dismiss|snooze",
    snooze_until: "datetime?"
  }
}
```

**Deliverables**:
- At least 3 working recommendation rules
- Recommendations stored and queryable
- Scoring algorithm implemented
- Can list, filter, and dismiss recommendations via MCP

---

## Phase 2: Plan & Execution System

### 2.1 Plan Generator

**Goal**: Convert recommendations into detailed, executable plans.

**Plan Structure**:
```go
type ExecutionPlan struct {
    ID              string
    RecommendationID string
    Status          string  // "draft", "pending_approval", "approved", "executing", "completed", "failed"
    
    EstimatedDuration time.Duration
    EstimatedCost     float64
    
    PreChecks  []Check
    Steps      []ExecutionStep
    PostChecks []Check
    
    RollbackPlan RollbackPlan
    
    ImpactAnalysis struct {
        AffectedUsers      int
        AffectedDashboards int
        AffectedQueries    int
        RiskLevel         string
    }
    
    ApprovalRequiredFrom []string
    ApprovedBy          string
    ApprovedAt          time.Time
    
    ExecutedAt  time.Time
    CompletedAt time.Time
    Error       string
}

type ExecutionStep struct {
    StepNumber      int
    Action          string
    SQL             string
    EstimatedTime   time.Duration
    RollbackAction  string
    Status          string
    Error           string
    StartedAt       time.Time
    CompletedAt     time.Time
}

type Check struct {
    Name        string
    Type        string  // "disk_space", "dependency", "permission", etc.
    Condition   string
    Status      string  // "pending", "passed", "failed"
    Message     string
}
```

**Plan Generator Logic**:
```go
type PlanGenerator interface {
    Generate(rec Recommendation) (ExecutionPlan, error)
}

// For "create materialized view" recommendation
type MaterializedViewPlanGenerator struct {}

func (g *MaterializedViewPlanGenerator) Generate(rec Recommendation) (ExecutionPlan, error) {
    plan := ExecutionPlan{
        ID: generateID(),
        RecommendationID: rec.ID,
        Status: "draft",
    }
    
    // Add pre-checks
    plan.PreChecks = []Check{
        {Name: "Verify disk space", Type: "disk_space"},
        {Name: "Check source table exists", Type: "dependency"},
        {Name: "Validate user permissions", Type: "permission"},
    }
    
    // Add steps
    plan.Steps = []ExecutionStep{
        {StepNumber: 1, Action: "Create materialized table", SQL: "CREATE TABLE ..."},
        {StepNumber: 2, Action: "Create indexes", SQL: "CREATE INDEX ..."},
        {StepNumber: 3, Action: "Update query definitions", SQL: "..."},
        {StepNumber: 4, Action: "Schedule refresh job", SQL: "..."},
    }
    
    // Add post-checks
    plan.PostChecks = []Check{
        {Name: "Verify row count", Type: "data_validation"},
        {Name: "Test query performance", Type: "performance_validation"},
    }
    
    // Generate rollback plan
    plan.RollbackPlan = generateRollbackPlan(plan.Steps)
    
    return plan, nil
}
```

**MCP Tools to Add**:
```typescript
{
  name: "plan_create",
  description: "Generate execution plan from recommendation",
  inputSchema: {
    recommendation_id: "string",
    customizations: "object?"  // User can override parameters
  }
}

{
  name: "plan_get",
  description: "Get execution plan details",
  inputSchema: {
    plan_id: "string"
  }
}

{
  name: "plan_list",
  description: "List execution plans with filters",
  inputSchema: {
    status: "draft|pending_approval|approved|executing|completed|failed|all",
    limit: "number?"
  }
}
```

---

### 2.2 Plan Executor

**Goal**: Execute plans safely with rollback capability.

**Executor Implementation**:
```go
type PlanExecutor struct {
    db          *sql.DB
    plan        ExecutionPlan
    checkpointer Checkpointer  // For rollback
}

func (e *PlanExecutor) Execute() error {
    // Update status
    e.plan.Status = "executing"
    e.plan.ExecutedAt = time.Now()
    
    // Run pre-checks
    if err := e.runChecks(e.plan.PreChecks); err != nil {
        return fmt.Errorf("pre-check failed: %w", err)
    }
    
    // Execute each step
    for i, step := range e.plan.Steps {
        // Create checkpoint for rollback
        if err := e.checkpointer.Save(step); err != nil {
            return fmt.Errorf("checkpoint failed: %w", err)
        }
        
        // Execute step
        e.plan.Steps[i].Status = "executing"
        e.plan.Steps[i].StartedAt = time.Now()
        
        if err := e.executeStep(step); err != nil {
            e.plan.Steps[i].Status = "failed"
            e.plan.Steps[i].Error = err.Error()
            
            // Rollback
            return e.Rollback()
        }
        
        e.plan.Steps[i].Status = "completed"
        e.plan.Steps[i].CompletedAt = time.Now()
    }
    
    // Run post-checks
    if err := e.runChecks(e.plan.PostChecks); err != nil {
        return e.Rollback()
    }
    
    e.plan.Status = "completed"
    e.plan.CompletedAt = time.Now()
    
    return nil
}

func (e *PlanExecutor) Rollback() error {
    // Execute rollback steps in reverse order
    for i := len(e.plan.Steps) - 1; i >= 0; i-- {
        step := e.plan.Steps[i]
        if step.Status == "completed" {
            if err := e.executeRollback(step); err != nil {
                return fmt.Errorf("rollback failed at step %d: %w", i, err)
            }
        }
    }
    
    e.plan.Status = "rolled_back"
    return nil
}
```

**MCP Tools to Add**:
```typescript
{
  name: "plan_approve",
  description: "Approve and optionally execute a plan",
  inputSchema: {
    plan_id: "string",
    execute_immediately: "boolean",
    schedule: "string?"  // ISO datetime or cron
  }
}

{
  name: "plan_execute",
  description: "Execute an approved plan",
  inputSchema: {
    plan_id: "string"
  }
}

{
  name: "plan_rollback",
  description: "Rollback an executed plan",
  inputSchema: {
    plan_id: "string",
    reason: "string?"
  }
}

{
  name: "plan_status",
  description: "Get real-time execution status",
  inputSchema: {
    plan_id: "string"
  }
}
```

---

### 2.3 Execution Modes

**Goal**: Support multiple execution modes with governance.

**Mode Configuration**:
```go
type ExecutionMode string

const (
    ModeSuggest   ExecutionMode = "suggest"    // Show recommendations only
    ModePlan      ExecutionMode = "plan"       // Generate plan, await approval
    ModeAuto      ExecutionMode = "auto"       // Execute automatically if safe
    ModeScheduled ExecutionMode = "scheduled"  // Run on schedule
    ModeReactive  ExecutionMode = "reactive"   // Trigger on events
)

type ExecutionModeConfig struct {
    DefaultMode ExecutionMode
    
    AutoModeRules struct {
        Enabled              bool
        MaxCostPerJob        float64
        MaxDurationPerJob    time.Duration
        AllowedCategories    []string
        AllowedRiskLevels    []string
        MaxJobsPerDay        int
        RequireApprovalEvery time.Duration
    }
    
    ScheduledJobsConfig struct {
        Enabled           bool
        DefaultSchedule   string  // cron format
        MaxConcurrentJobs int
    }
    
    ReactiveTriggersConfig struct {
        Enabled  bool
        Triggers []ReactiveTrigger
    }
}

type ReactiveTrigger struct {
    Name      string
    Type      string  // "quality_threshold", "performance_degradation", "cost_spike"
    Condition string
    Action    string
    Enabled   bool
}
```

**Auto-Mode Safety System**:
```go
type SafetyValidator struct {
    config ExecutionModeConfig
}

func (v *SafetyValidator) CanAutoExecute(plan ExecutionPlan) (bool, string) {
    if !v.config.AutoModeRules.Enabled {
        return false, "auto mode disabled"
    }
    
    // Check cost limit
    if plan.EstimatedCost > v.config.AutoModeRules.MaxCostPerJob {
        return false, "exceeds cost limit"
    }
    
    // Check duration limit
    if plan.EstimatedDuration > v.config.AutoModeRules.MaxDurationPerJob {
        return false, "exceeds duration limit"
    }
    
    // Check risk level
    if !contains(v.config.AutoModeRules.AllowedRiskLevels, plan.RiskLevel) {
        return false, "risk level not allowed"
    }
    
    // Check daily job limit
    todayCount := countJobsToday()
    if todayCount >= v.config.AutoModeRules.MaxJobsPerDay {
        return false, "daily job limit reached"
    }
    
    return true, ""
}
```

**MCP Tools to Add**:
```typescript
{
  name: "execution_mode_get",
  description: "Get current execution mode configuration",
  inputSchema: {}
}

{
  name: "execution_mode_set",
  description: "Configure execution mode settings",
  inputSchema: {
    mode: "suggest|plan|auto|scheduled|reactive",
    config: "object"  // Mode-specific configuration
  }
}

{
  name: "job_schedule",
  description: "Schedule a recurring job",
  inputSchema: {
    plan_id: "string",
    schedule: "string",  // cron format
    dependencies: "array?",
    quality_gates: "array?"
  }
}

{
  name: "job_list",
  description: "List scheduled and reactive jobs",
  inputSchema: {
    type: "scheduled|reactive|all",
    status: "active|paused|completed|all"
  }
}

{
  name: "job_cancel",
  description: "Cancel or pause a job",
  inputSchema: {
    job_id: "string",
    action: "cancel|pause"
  }
}
```

---

## Phase 3: Advanced Features

### 3.1 Natural Language to SQL

**Goal**: Allow users to query in natural language with semantic understanding.

**Components**:

1. **Business Term Dictionary**
```go
type BusinessTerm struct {
    Term        string
    Definition  string
    SQLTemplate string
    Context     string
    Examples    []string
}

// Example:
{
    Term: "high-value customer",
    Definition: "Customer with lifetime value > $10,000",
    SQLTemplate: "ltv > 10000",
    Context: "customer_context",
    Examples: ["show me high value customers", "hvc analysis"]
}
```

2. **Semantic Query Parser**
```go
type SemanticQueryParser struct {
    llm           LLMClient  // Claude API
    businessTerms map[string]BusinessTerm
    schema        SchemaKnowledge
}

func (p *SemanticQueryParser) ParseToSQL(nlQuery string, context string) (string, float64, error) {
    // Build prompt with schema context and business terms
    prompt := p.buildPrompt(nlQuery, context)
    
    // Call LLM to generate SQL
    response := p.llm.Complete(prompt)
    
    // Validate generated SQL
    valid, confidence := p.validateSQL(response.SQL)
    
    return response.SQL, confidence, nil
}
```

3. **Ambiguity Resolution**
```go
type AmbiguityResolver struct {}

func (r *AmbiguityResolver) Resolve(query string) ([]Interpretation, error) {
    // Example: "last quarter" could mean:
    // - Fiscal Q4 2024
    // - Calendar Q4 2024
    // - Most recent completed quarter
    
    interpretations := []Interpretation{
        {Text: "Fiscal Q4 2024", Confidence: 0.8},
        {Text: "Calendar Q4 2024", Confidence: 0.6},
    }
    
    return interpretations, nil
}
```

**MCP Tools to Add**:
```typescript
{
  name: "nl_query",
  description: "Execute natural language query with semantic understanding",
  inputSchema: {
    query: "string",
    context_id: "string?",
    explain: "boolean?",  // Show SQL translation
    alternatives: "boolean?"  // Show alternative interpretations
  }
}

{
  name: "business_term_define",
  description: "Define or update business term",
  inputSchema: {
    term: "string",
    definition: "string",
    sql_template: "string",
    examples: "array?"
  }
}

{
  name: "business_terms_list",
  description: "List available business terms",
  inputSchema: {
    context_id: "string?",
    search: "string?"
  }
}
```

---

### 3.2 Automated Feature Engineering

**Goal**: Generate ML features automatically based on target variable and use case.

**Feature Generation Engine**:
```go
type FeatureGenerator struct {
    targetColumn string
    targetType   string  // "classification", "regression"
    tables       []string
}

func (g *FeatureGenerator) GenerateFeatures() ([]Feature, error) {
    features := []Feature{}
    
    // Time-based aggregations
    features = append(features, g.generateTimeFeatures()...)
    
    // Rolling windows
    features = append(features, g.generateRollingFeatures()...)
    
    // Interaction features
    features = append(features, g.generateInteractionFeatures()...)
    
    // Categorical encodings
    features = append(features, g.generateCategoricalFeatures()...)
    
    // Remove leaky features
    features = g.removeLeakage(features)
    
    // Score and rank
    features = g.scoreFeatures(features)
    
    return features, nil
}

type Feature struct {
    Name           string
    SQL            string
    Type           string
    Description    string
    Importance     float64  // Estimated
    Correlation    float64  // With target
    IsLeaky        bool
    Dependencies   []string
}
```

**MCP Tools to Add**:
```typescript
{
  name: "features_generate",
  description: "Auto-generate ML features for a use case",
  inputSchema: {
    target_column: "string",
    target_type: "classification|regression",
    tables: "array",
    max_features: "number?"
  }
}

{
  name: "features_materialize",
  description: "Create feature table from generated features",
  inputSchema: {
    features: "array",
    table_name: "string",
    refresh_schedule: "string?"
  }
}

{
  name: "features_validate",
  description: "Check for leakage, correlation, stability",
  inputSchema: {
    features: "array",
    target_column: "string"
  }
}
```

---

### 3.3 Automated Data Discovery

**Goal**: Scan database and automatically discover entities, relationships, and patterns.

**Discovery Engine**:
```go
type DataDiscovery struct {
    db *sql.DB
}

func (d *DataDiscovery) DiscoverAll() (*DiscoveryReport, error) {
    report := &DiscoveryReport{}
    
    // Discover tables and columns
    report.Tables = d.discoverTables()
    
    // Infer relationships (foreign keys)
    report.Relationships = d.inferRelationships()
    
    // Profile data (distributions, cardinality)
    report.Profiles = d.profileData()
    
    // Detect entities (customer, product, order, etc.)
    report.Entities = d.detectEntities()
    
    // Cluster similar columns
    report.ColumnClusters = d.clusterColumns()
    
    return report, nil
}

type DiscoveryReport struct {
    Tables          []TableInfo
    Relationships   []Relationship
    Profiles        []DataProfile
    Entities        []Entity
    ColumnClusters  []ColumnCluster
}

type Relationship struct {
    FromTable   string
    FromColumn  string
    ToTable     string
    ToColumn    string
    Confidence  float64
    JoinPath    string
}
```

**MCP Tools to Add**:
```typescript
{
  name: "discover_database",
  description: "Scan database and discover structure, relationships, patterns",
  inputSchema: {
    database: "string?",
    deep_scan: "boolean?",  // Include data profiling
    save_catalog: "boolean?"
  }
}

{
  name: "discover_entity",
  description: "Find all data related to an entity (e.g., 'customer')",
  inputSchema: {
    entity: "string",  // "customer", "product", etc.
    include_joins: "boolean?"
  }
}

{
  name: "suggest_context",
  description: "Suggest semantic context based on discovery",
  inputSchema: {
    use_case: "string",  // "churn analysis", "revenue reporting", etc.
    tables: "array?"
  }
}
```

---

### 3.4 Monitoring & Anomaly Detection

**Goal**: Continuously monitor data quality, performance, and detect anomalies.

**Monitoring System**:
```go
type Monitor struct {
    checks []HealthCheck
    alerts AlertManager
}

type HealthCheck interface {
    Name() string
    Check() (*HealthStatus, error)
    Threshold() Threshold
}

// Example: Schema drift check
type SchemaDriftCheck struct {
    table          string
    lastSnapshot   SchemaSnapshot
    threshold      float64
}

func (c *SchemaDriftCheck) Check() (*HealthStatus, error) {
    current := getSchemaSnapshot(c.table)
    changes := detectChanges(c.lastSnapshot, current)
    
    status := &HealthStatus{
        CheckName: "schema_drift",
        Status:    "healthy",
        Message:   "No schema changes detected",
        Timestamp: time.Now(),
    }
    
    if len(changes) > 0 {
        status.Status = "warning"
        status.Message = fmt.Sprintf("%d schema changes detected", len(changes))
        status.Details = changes
    }
    
    return status, nil
}

// Example: Data freshness check
type DataFreshnessCheck struct {
    table         string
    timestampCol  string
    maxStaleness  time.Duration
}

// Example: Volume anomaly check
type VolumeAnomalyCheck struct {
    table     string
    baseline  VolumeBaseline
    threshold float64  // Deviation percentage
}
```

**MCP Tools to Add**:
```typescript
{
  name: "monitor_health",
  description: "Get current health status of monitored resources",
  inputSchema: {
    resource: "string?",  // Specific table/query/pipeline
    check_type: "schema|freshness|quality|performance|all"
  }
}

{
  name: "monitor_configure",
  description: "Configure monitoring checks and alerts",
  inputSchema: {
    resource: "string",
    checks: "array",
    alert_channels: "array"
  }
}

{
  name: "anomalies_list",
  description: "List detected anomalies",
  inputSchema: {
    severity: "critical|warning|info|all",
    time_range: "object?",
    resolved: "boolean?"
  }
}

{
  name: "anomaly_resolve",
  description: "Mark anomaly as resolved or create remediation plan",
  inputSchema: {
    anomaly_id: "string",
    action: "resolve|investigate|auto_remediate"
  }
}
```

---

## Phase 4: MCP-UI Interface

### 4.1 React Components

**Goal**: Build chat-based UI that surfaces recommendations and allows interaction.

**Key Components**:

1. **RecommendationCard.tsx**
```typescript
interface RecommendationCardProps {
  recommendation: Recommendation;
  onCreatePlan: (id: string) => void;
  onDismiss: (id: string) => void;
}

// Displays single recommendation with:
// - Title, description, priority badge
// - Impact metrics (time saved, cost saved)
// - Confidence score
// - Action buttons (Create Plan, Dismiss, Details)
```

2. **ExecutionPlanViewer.tsx**
```typescript
interface ExecutionPlanViewerProps {
  plan: ExecutionPlan;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

// Shows detailed execution plan:
// - Pre-checks status
// - Step-by-step breakdown
// - Post-checks
// - Rollback plan
// - Approval buttons
```

3. **JobStatusMonitor.tsx**
```typescript
interface JobStatusMonitorProps {
  jobId: string;
  realtime: boolean;
}

// Real-time execution status:
// - Progress bar
// - Current step
// - Logs
// - Time elapsed
// - Cancel button
```

4. **RecommendationDashboard.tsx**
```typescript
// Overview widget showing:
// - Active recommendations count
// - Plans pending approval
// - Jobs executed today
// - Estimated monthly impact
// - Recent actions log
```

5. **SchemaExplorer.tsx**
```typescript
// Interactive schema browser:
// - Tree view of databases/tables/columns
// - Drift indicators
// - Quick stats (row count, size)
// - Inline semantic annotation
```

**File Structure**:
```
mcp-ui/
├── src/
│   ├── components/
│   │   ├── recommendations/
│   │   │   ├── RecommendationCard.tsx
│   │   │   ├── RecommendationList.tsx
│   │   │   └── RecommendationDashboard.tsx
│   │   ├── execution/
│   │   │   ├── ExecutionPlanViewer.tsx
│   │   │   ├── JobStatusMonitor.tsx
│   │   │   └── JobHistory.tsx
│   │   ├── schema/
│   │   │   ├── SchemaExplorer.tsx
│   │   │   ├── DriftIndicator.tsx
│   │   │   └── SemanticAnnotator.tsx
│   │   └── shared/
│   │       ├── QueryEditor.tsx
│   │       ├── DataTable.tsx
│   │       └── ImpactBadge.tsx
│   ├── hooks/
│   │   ├── useMCP.ts
│   │   ├── useRecommendations.ts
│   │   └── useExecutionPlan.ts
│   ├── services/
│   │   └── mcp-client.ts
│   └── App.tsx
├── package.json
└── tsconfig.json
```

---

### 4.2 Chat Interface Integration

**Goal**: Embed UI components naturally in chat conversation.

**Interaction Patterns**:

1. **Proactive Recommendations**
```
[System notification appears in chat]

╔═══════════════════════════════════════════════════════════╗
║ 💡 NEW RECOMMENDATION                                     ║
╠═══════════════════════════════════════════════════════════╣
║ Materialize customer revenue summary                      ║
║                                                           ║
║ Impact: Save 11.3 hrs/day, $340/month                    ║
║ Confidence: 92%                                           ║
║                                                           ║
║ [ View Details ]  [ Create Plan ]  [ Dismiss ]           ║
╚═══════════════════════════════════════════════════════════╝

User can click or type:
> "Show me the plan"
> "Why do you recommend this?"
> "Dismiss this"
```

2. **Query with Results**
```
User: "Show me all high-value customers who churned last month"

[SemanticQueryComponent renders]
┌─────────────────────────────────────────────────────────┐
│ 🔍 Query Interpretation                                 │
├─────────────────────────────────────────────────────────┤
│ • high-value: customers.ltv > 10000                    │
│ • churned: status = 'cancelled'                        │
│ • last month: cancel_date >= '2025-01-01'             │
│                                                        │
│ Confidence: 85%                                        │
│ [ Edit SQL ] [ See Alternatives ]                     │
└─────────────────────────────────────────────────────────┘

[DataTableComponent renders results]
┌─────────────────────────────────────────────────────────┐
│ Results (127 rows)                                      │
├─────────────────────────────────────────────────────────┤
│ customer_id | name          | ltv     | cancel_date   │
│ ------------|---------------|---------|---------------│
│ 10234       | Acme Corp     | $45,230 | 2025-01-15   │
│ ...                                                     │
│                                                        │
│ [ Export CSV ] [ Create Feature Table ] [ Visualize ] │
└─────────────────────────────────────────────────────────┘
```

3. **Execution Progress**
```
User: "Approve plan #1234"

[ExecutionProgressComponent renders]
┌─────────────────────────────────────────────────────────┐
│ ⚙️ Executing Plan: Materialize revenue summary         │
├─────────────────────────────────────────────────────────┤
│ ✓ Pre-checks passed                                    │
│ ⏳ Step 1/4: Creating table... (2m 15s elapsed)        │
│ ⏸  Step 2/4: Adding indexes                            │
│ ⏸  Step 3/4: Updating queries                          │
│ ⏸  Step 4/4: Scheduling refresh                        │
│                                                        │
│ [ View Logs ] [ Cancel ]                              │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Recommended Build Order

**Week 1-2: Foundation**
1. Set up MCP server scaffold (Go or Python)
2. Implement Teradata connection
3. Build basic MCP tools (query, schema, recommendations stub)
4. Add observation layer (query tracking, schema snapshots)
5. Set up local storage (SQLite/bbolt)

**Week 3-4: Recommendations**
6. Implement 3-5 recommendation rules
7. Build scoring algorithm
8. Add recommendation CRUD operations
9. Test recommendation generation with real usage data

**Week 5-6: Plan & Execution**
10. Build plan generator for top recommendation types
11. Implement execution engine with rollback
12. Add pre/post checks
13. Build safety validator for auto-mode

**Week 7-8: Execution Modes**
14. Implement mode configuration system
15. Build scheduled jobs system (cron)
16. Add reactive triggers
17. Build governance rules engine

**Week 9-10: React UI**
18. Set up React project with TypeScript
19. Build MCP client service
20. Create core components (RecommendationCard, PlanViewer, etc.)
21. Integrate with chat interface

**Week 11-12: Advanced Features**
22. Add NL to SQL with LLM integration
23. Build feature generation engine
24. Add data discovery system
25. Implement monitoring & anomalies

**Week 13-14: Polish & Testing**
26. End-to-end testing
27. Performance optimization
28. Documentation
29. Demo scenarios

---

## Configuration Files

### config.yaml
```yaml
teradata:
  host: "${TD_HOST}"
  port: 1025
  database: "${TD_DATABASE}"
  user: "${TD_USER}"
  password: "${TD_PASSWORD}"
  
observation:
  enabled: true
  storage: "sqlite:observations.db"
  retention_days: 90
  
  query_tracking:
    enabled: true
    sample_rate: 1.0  # Track 100% of queries
    
  schema_snapshots:
    enabled: true
    schedule: "0 2 * * *"  # Daily at 2 AM
    
  performance_metrics:
    enabled: true
    thresholds:
      slow_query_seconds: 5.0
      
recommendation:
  enabled: true
  refresh_interval: "1h"
  
  rules:
    - name: "frequent_query"
      enabled: true
      params:
        min_executions_per_day: 10
        min_avg_duration: 3.0
        
    - name: "missing_index"
      enabled: true
      params:
        min_rows_scanned: 100000
        
    - name: "schema_drift"
      enabled: true
      
execution:
  default_mode: "plan"  # suggest, plan, auto, scheduled, reactive
  
  auto_mode:
    enabled: false
    max_cost_per_job: 50.0
    max_duration_per_job: "30m"
    allowed_categories: ["performance", "quality"]
    allowed_risk_levels: ["low", "very_low"]
    max_jobs_per_day: 10
    
  scheduled_jobs:
    enabled: true
    max_concurrent: 5
    
  reactive_triggers:
    enabled: true
    
logging:
  level: "info"
  format: "json"
  output: "stdout"
  
mcp:
  server:
    name: "teradata-semantic-viewer"
    version: "1.0.0"
  transport:
    type: "stdio"
```

---

## Testing Strategy

### Unit Tests
```go
// Test recommendation rules
func TestFrequentQueryRule(t *testing.T) {
    rule := &FrequentQueryRule{
        Threshold: 10,
        DurationThreshold: 3.0,
    }
    
    observations := []Observation{
        {Type: "query", Count: 15, AvgDuration: 5.2},
    }
    
    recs := rule.Evaluate(observations)
    assert.Len(t, recs, 1)
    assert.Equal(t, "performance", recs[0].Type)
}

// Test plan generation
func TestMaterializedViewPlanGenerator(t *testing.T) {
    gen := &MaterializedViewPlanGenerator{}
    rec := Recommendation{Type: "create_materialized_view"}
    
    plan, err := gen.Generate(rec)
    assert.NoError(t, err)
    assert.Len(t, plan.Steps, 4)
    assert.NotEmpty(t, plan.RollbackPlan)
}

// Test safety validator
func TestSafetyValidator(t *testing.T) {
    validator := &SafetyValidator{config: defaultConfig}
    plan := ExecutionPlan{
        EstimatedCost: 25.0,
        EstimatedDuration: 15 * time.Minute,
        RiskLevel: "low",
    }
    
    canExecute, reason := validator.CanAutoExecute(plan)
    assert.True(t, canExecute)
    assert.Empty(t, reason)
}
```

### Integration Tests
```go
// Test end-to-end recommendation flow
func TestRecommendationFlow(t *testing.T) {
    // 1. Record query observations
    recordQueryExecution("SELECT * FROM customers WHERE segment = 'premium'", 15)
    recordQueryExecution("SELECT * FROM customers WHERE segment = 'premium'", 12)
    // ... record 10+ times
    
    // 2. Trigger recommendation engine
    recs := generateRecommendations()
    
    // 3. Verify recommendation created
    assert.Len(t, recs, 1)
    assert.Equal(t, "create_materialized_view", recs[0].Type)
    
    // 4. Generate plan
    plan, err := createPlan(recs[0].ID)
    assert.NoError(t, err)
    
    // 5. Execute plan (in test mode)
    err = executePlan(plan, testMode=true)
    assert.NoError(t, err)
}

// Test MCP protocol
func TestMCPTools(t *testing.T) {
    server := startMCPServer()
    defer server.Stop()
    
    // Test semantic_query tool
    result := server.CallTool("semantic_query", map[string]any{
        "query": "SELECT * FROM customers LIMIT 10",
        "format": "json",
    })
    assert.NoError(t, result.Error)
    assert.NotEmpty(t, result.Content)
}
```

---

## Success Metrics

Track these metrics to measure impact:

**For Users**:
- Time saved per week (query time reduction)
- Number of manual tasks automated
- Self-service queries (NL → SQL success rate)

**For System**:
- Recommendations generated per day
- Recommendations accepted/dismissed ratio
- Auto-executed jobs per week
- Query performance improvements (p50, p95, p99)
- Cost savings from optimizations

**For Data Quality**:
- Schema drift incidents detected
- Data quality issues resolved
- Anomalies caught before impacting users

---

## Documentation Requirements

**README.md**:
- Quick start guide
- Architecture overview
- Configuration options
- MCP tool reference

**ARCHITECTURE.md**:
- System design
- Component interactions
- Data flow diagrams
- Extension points

**API.md**:
- Complete MCP tool documentation
- Request/response examples
- Error codes

**DEPLOYMENT.md**:
- Installation instructions
- Teradata setup requirements
- Environment variables
- Troubleshooting

---

## Next Steps

1. **Choose your starting point**: Phase 1.1 (MCP Server Scaffold)
2. **Set up development environment**: Go/Python, Teradata driver, IDE
3. **Clone/create repository structure**
4. **Build first MCP tool** (semantic_query)
5. **Test connection to Teradata**
6. **Iterate through phases**

**Start with**: "Build the MCP server scaffold in Go with basic semantic_query tool that connects to Teradata and returns query results in JSON format."

This prompt provides a complete roadmap. Focus on building incrementally, testing at each phase, and ensuring each component works before moving to the next.

Good luck! Let me know if you need clarification on any section.
