# SurfaceUI MCP Kit — Prioritized Roadmap

## Overview

SurfaceUI is the canonical rendering layer for MCP Apps across hosts (Claude Desktop, Web, VS Code, AI Studio, etc.).

It is not just a UI library — it is the deterministic UI surface for agentic systems.

SurfaceUI enables:
- Structured rendering of MCP tool outputs
- Inspectable AI execution
- Low-code ↔ Pro-code parity
- Enterprise-grade transparency
- Artifact persistence across workspaces

---

# 🥇 Phase 1 — Core Execution Surfaces (Must Ship First)

These unlock the majority of immediate user value.

---

## 1️⃣ SurfaceTable

**Purpose:** Universal structured data viewer  
**Why Priority:** Every tool call returns rows.

### Capabilities
- Virtualized rendering for large datasets
- Column sorting and filtering
- Inline summary statistics
- CSV / Parquet export
- "Open in SQL" deep link
- Save as artifact

### MCP Tool (Placeholder)

This surface is rendered when an MCP tool returns a compatible response envelope.

**Example Tool Category (Placeholder Only):**
- Query execution tool
- Data preview tool
- Model scoring tool
- Profiling tool

> Note: Exact MCP tool names and contracts will be defined in the MCP server specification. SurfaceUI components should map to response schema types — not hard-coded tool names.

---

## 2️⃣ SurfaceSemanticViewer

**Purpose:** Semantic data and relationship viewer
**Why Priority:** Enables inspection of structured semantic data, ontologies, and knowledge graphs.

### Capabilities
- Entity relationship visualization
- Triple viewer (subject-predicate-object)
- Ontology tree navigation
- Property inspector panel
- SPARQL query support
- Namespace management
- RDF/JSON-LD format toggle
- Export as Turtle/N-Triples/JSON-LD

### Features
- Interactive graph navigation
- Entity detail panels with properties
- Relationship filtering and highlighting
- Search across entities and predicates
- Schema validation indicators
- Linked data preview

### MCP Tool (Placeholder)

This surface is rendered when an MCP tool returns semantic data or knowledge graph responses.

**Example Tool Category (Placeholder Only):**
- Knowledge graph query tool
- Ontology inspection tool
- Entity resolution tool
- Semantic search tool

> Note: Exact MCP tool names and contracts will be defined in the MCP server specification. SurfaceUI components should map to response schema types — not hard-coded tool names.

---

## 3️⃣ SurfaceChart

**Purpose:** Auto-rendered visualization surface
**Why Priority:** Converts results into insights.

### Supported Charts
- Line
- Bar
- Area
- Scatter
- Sankey (for path analysis)
- Heatmap
- Geo maps

### Features
- Editable chart configuration
- Narrative side panel
- "Explain this chart" AI hook
- Save to dashboard

---

## 4️⃣ SurfaceExplain

**Purpose:** Visual query explain DAG
**Why Priority:** Major enterprise differentiator.

### Features
- DAG layout visualization
- Operator nodes (scan, join, spool)
- Cost overlays
- CPU vs IO indicators
- Optimization suggestions panel

---

## 5️⃣ SurfaceSQL

**Purpose:** NL ↔ SQL transparency surface
**Why Priority:** Enables Ask ↔ Code parity.

### Layout
- Intent interpretation panel
- Generated SQL editor
- Inline execution controls
- Result preview panel
- Confidence and schema grounding indicators

---

# 🥈 Phase 2 — Agentic & Workflow Surfaces

These define the AI-native orchestration layer.

---

## 6️⃣ SurfacePlan

**Purpose:** Inspectable agent execution plan

### Features
- Tree view of execution steps
- Tool call visibility
- SQL preview per step
- Editable nodes
- Deterministic confirmation mode

---

## 7️⃣ SurfaceWorkflow

**Purpose:** Visual Compose mode

### Features
- Node-based DAG canvas
- Open node → SQL / Code
- Version history
- Artifact outputs
- Collaboration and locking support

---

## 8️⃣ SurfaceExecution

**Purpose:** Runtime monitoring surface

### Displays
- Status timeline
- Compute metrics
- Cost estimates
- Retry controls
- Logs panel

---

# 🥉 Phase 3 — Data Trust & Governance Surfaces

Enterprise trust layer.

---

## 9️⃣ SurfaceProfile

**Purpose:** Data profiling dashboard

### Panels
- Column distribution
- Null rate
- Cardinality
- Outlier detection
- Drift analysis

Built using SurfaceChart + SurfaceTable primitives.

---

## 🔟 SurfaceLineage

**Purpose:** Impact and lineage graph

### Displays
- Table → Model → Report relationships
- Column-level lineage
- Change impact preview

---

## 1️⃣1️⃣ SurfaceCost

**Purpose:** Consumption transparency surface

### Displays
- Query cost
- Compute time
- Region
- Budget alerts
- Optimization suggestions

---

# 🏗️ Phase 4 — Platform-Level Surfaces

These compound artifacts across workspaces.

---

## 1️⃣2️⃣ SurfaceArtifacts

**Purpose:** Artifact registry

### Shows
- Queries
- Prompts
- Workflows
- Models
- Dashboards

Includes versioning and search.

---

## 1️⃣3️⃣ SurfaceInsight

**Purpose:** Executive narrative surface

### Displays
- AI-generated summary
- Supporting visualizations
- Statistical highlights
- Confidence scoring

Boardroom-ready insight mode.

---

# Strategic Sequencing

## Wave 1 — AI Studio Foundation
- SurfaceTable
- SurfaceSemanticViewer
- SurfaceChart
- SurfaceSQL
- SurfaceExplain

## Wave 2 — Agentic Trust Layer
- SurfacePlan
- SurfaceExecution
- SurfaceProfile

## Wave 3 — Compose Expansion
- SurfaceWorkflow
- SurfaceArtifacts

## Wave 4 — Enterprise Differentiation
- SurfaceLineage
- SurfaceCost
- SurfaceInsight

---

# SurfaceUI Design Principles

1. All surfaces render from structured JSON schemas.
2. Host-agnostic rendering (Web, IDE, Desktop).
3. Every surface supports:
   - Save as artifact
   - Open in code
   - Audit trail metadata
4. Surfaces can embed other surfaces.
5. Dark mode first.
6. Deterministic execution transparency is required.

---

# Long-Term Vision

SurfaceUI becomes the standardized UI layer for agentic systems:

AI → Structured Intent → Tool Execution → SurfaceUI → Inspectable Artifact

This transforms chat from a text interface into a governed, operational workspace.

