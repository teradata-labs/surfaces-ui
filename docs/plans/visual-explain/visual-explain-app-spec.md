# Visual EXPLAIN App — Build Spec v2

> **Status**: Wireframe complete. Ready for production build.
> **Reference file**: `visual-explain-app.html` — working standalone wireframe, zero dependencies.
> **Last updated**: March 2026 — based on live Teradata EXPLAIN analysis session.

---

## What this is

An interactive Teradata EXPLAIN plan visualizer built with the surfaces-ui design system. Inspired by workflow builders (Pipedream/n8n), adapted for SQL query plan analysis. Each EXPLAIN step becomes a clickable node in a vertical workflow. Clicking a node highlights the corresponding SQL fragment and shows a structured analysis card. Claude handles deep analysis in chat via `sendPrompt()`.

---

## Current wireframe state

The HTML wireframe (`visual-explain-app.html`) is a complete, self-contained reference implementation. It:

- Runs standalone in any browser (open the file directly — no server needed)
- Uses zero external dependencies — no CDN calls, no framework
- Implements the full 3-query dataset from the Titanic EXPLAIN session
- Has all `sendPrompt()` calls wired and stubbed (falls back to `console.log` / `alert` outside Claude)
- Is dark-mode aware via `@media (prefers-color-scheme: dark)` and CSS variables throughout
- Serves as the visual reference for the production surfaces-ui React build

---

## Architecture decisions (final)

### Panel layout

```
┌─────────────────────────────────────────────────────────┐
│  TOPBAR: brand · query selector · Copy SQL · Run EXPLAIN │
├──────────────┬──────────────────────────────────────────┤
│              │                                           │
│  WORKFLOW    │  ANALYSIS CARD                            │
│  NODES       │  (structured metadata, not markdown)      │
│  (left col)  │                                           │
│              │  Step icon · type badge · confidence badge │
│  Step 1      │  Metric grid (rows, bytes, time, scan)    │
│    │         │  Optimizer rewrites (highlighted mono)    │
│  Step 2 ←   │  Observations (color-coded by severity)   │
│    │  active │  CTA buttons → sendPrompt()               │
│  Step 3      │                                           │
│    │         ├──────────────────────────────────────────┤
│  Step 4      │  SQL EDITOR (collapsible, bottom)         │
│              │  <details>/<summary> — native, zero JS    │
│              │  textarea + <pre> highlight overlay        │
│              │  [Optimize ↗] [CTE ↗] [STATS ↗] [Copy]   │
│              │  └─ Raw EXPLAIN (nested collapsible)       │
└──────────────┴──────────────────────────────────────────┘
```

### Analysis rendering — Hybrid (Option C) ✅

**App owns**: Step type, confidence badge, spool rows/bytes, estimated time, scan type, optimizer rewrites, color-coded observation items.

**Claude owns**: Deep analysis, multi-step comparison, optimization recommendations, COLLECT STATS suggestions, CTE rewrites — all triggered via `sendPrompt()`.

**Why**: Structured cards are always visible without scrolling. Claude's responses are richer (tables, code blocks, comparisons) than anything a markdown renderer inside the app would produce. The `sendPrompt()` bridge is lightweight and already works in the artifact environment.

### SQL Editor — bottom, collapsible ✅

**Placement**: Bottom of right column, above nothing — the SQL panel is the last element before the viewport edge. Collapsed by default so the analysis card gets full vertical space.

**Collapsible mechanism**: Native `<details>`/`<summary>` — zero JS, zero dependencies, CSS-animatable, supported in every browser. No accordion library needed.

**No syntax highlighting library**: We need clause-level fragment highlighting (which GROUP BY is active), not token colorization. Native `<mark>` inside a `<pre>` overlay delivers exactly this at zero cost.

**Pattern**:

```html
<div style="position: relative">
  <div class="sql-highlight">   ← <pre> with <mark> fragments, pointer-events: none, z-index 1
  <textarea class="sql-textarea"> ← editable, transparent bg, z-index 2
</div>
```

Active step drives which SQL clause fragment gets `<mark>` applied. Regex per step type extracts the clause.

**Highlight mapping**:
| Step type | Highlighted clause |
|---|---|
| `lock` | Table name in FROM |
| `agg` | GROUP BY clause |
| `sort` | ORDER BY clause |
| `return` | SELECT keyword |

### Dependency evaluation — final decisions

| Need                   | Evaluated                          | Decision                                                                       | Rationale                                                            |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Collapsible panel      | accordion lib, `<details>`         | ✅ `<details>`/`<summary>` native                                              | Zero JS, already in every browser                                    |
| SQL fragment highlight | Prism.js (~30KB), `<mark>` overlay | ✅ `<mark>` + `<pre>`                                                          | Clause-level only — no token colorization needed                     |
| Icons                  | Custom SVG, lucide-react           | ✅ Unicode/emoji for wireframe; lucide-react in React build (already in scope) | lucide-react is already available in artifact env at zero extra cost |
| Monospace font         | External font                      | ✅ `var(--font-mono)`                                                          | Already in surfaces-ui token set                                     |
| Syntax editor          | CodeMirror, Monaco                 | ✅ `<textarea>`                                                                | Simpler state, easier dark mode, no deps                             |
| Markdown renderer      | marked.js, react-markdown          | ✅ Skipped — Claude renders in chat                                            | Analysis quality is better in chat; `sendPrompt()` is the bridge     |

---

## Component specs

### WorkflowNode

Pipedream-style card node. Vertical stack with arrow connectors between steps.

**Visual states**:

- Default: `bg-primary` + `border-secondary`
- Hover: `bg-secondary` + `border-primary`
- Active: `bg-info` + `border-info` (blue tint)

**Color mapping by step type**:
| Type | Icon | Badge color |
|---|---|---|
| `lock` | 🔒 | gray (`#f1efe8 / #5f5e5a`) |
| `agg` | Σ | purple (`#eeedfe / #534ab7`) |
| `sort` | ↕ | teal (`#e1f5ee / #0f6e56`) |
| `return` | ↩ | green (`#eaf3de / #3b6d11`) |

**Confidence badge colors**:
| Confidence | Background | Text |
|---|---|---|
| No confidence | `#fcebeb` | `#a32d2d` |
| Low | `#faeeda` | `#854f0b` |
| Moderate | `#e1f5ee` | `#0f6e56` |
| High | `#eaf3de` | `#3b6d11` |

**Connector**: 1px vertical line, `border-secondary`, with a 7×7px chevron arrowhead at the bottom. Pure CSS, no SVG.

### StepAnalysisCard

Structured metadata card in the right panel. Replaces markdown rendering.

**Sections (in order)**:

1. **Header row**: Step icon (18px) · step number + label · type badge · confidence badge
2. **Metrics grid** (2×2): Spool rows · Spool bytes · Estimated time · Scan type
3. **Optimizer rewrites** (if any): Monospace pill, purple tint — e.g. `age < 13 → age <= 12`
4. **Observations**: Color-coded left-border items
   - Default: `border-secondary` (neutral)
   - Warning: `#ba7517` amber border (e.g. "no statistics collected")
   - Info: `#185fa5` blue border (e.g. optimizer rewrites)
5. **CTA row**: Explain ↗ · Optimize ↗ · Compare all ↗

### SQLEditor (collapsible)

**Collapsed state** (default): Shows summary bar with label + query count meta.

**Open state**: Shows textarea + highlight overlay + action buttons + nested raw EXPLAIN collapsible.

**Nested collapsible** (raw EXPLAIN): Second `<details>` inside the editor body. Collapsed by default. Shows the raw EXPLAIN text in a `<pre>` with `max-height: 150px; overflow-y: auto`.

**Action buttons**:
| Button | `sendPrompt()` payload |
|---|---|
| Optimize ↗ | Teradata optimization request with full SQL |
| Rewrite as CTE ↗ | CTE rewrite request targeting GROUP BY ordinal |
| Collect STATS ↗ | COLLECT STATISTICS suggestions based on GROUP BY / ORDER BY columns |
| Copy | `navigator.clipboard.writeText(sql)` — no Claude call |

---

## sendPrompt() integration

All Claude-assisted actions go through `sendPrompt()`. The wireframe stubs this with `console.log` + `alert` so it runs standalone. In the Claude artifact environment the global `sendPrompt` function is already available.

### Call patterns

```js
// Run live EXPLAIN via MCP
sendPrompt(`Run EXPLAIN on this SQL using teradata-community:base_readQuery:\n\n${sql}`);

// Step-level explanation
sendPrompt(
  `Explain step ${n} of this Teradata EXPLAIN plan:\n\nStep: ${step.label}\nConfidence: ${step.confidence}\nObservations: ${step.obs.join('; ')}\n\nFull EXPLAIN:\n${raw}`,
);

// Optimization
sendPrompt(`Optimize this Teradata SQL. Focus on: ${issues.join(', ')}:\n\n${sql}`);

// CTE rewrite
sendPrompt(
  `Rewrite this Teradata SQL using a CTE to eliminate GROUP BY ordinal references:\n\n${sql}`,
);

// COLLECT STATS
sendPrompt(`What COLLECT STATISTICS statements should I run for this query?\n\n${sql}`);

// Compare before/after
sendPrompt(
  `Compare these two EXPLAIN outputs and tell me what improved:\n\nBEFORE:\n${before}\n\nAFTER:\n${after}`,
);
```

---

## EXPLAIN parsing logic (for production build)

When Claude returns a live EXPLAIN response, parse it into the step data structure client-side:

```js
function parseExplain(text) {
  const steps = [];
  const stepBlocks = text.split(/\n(?=\s*\d+\))/);
  for (const block of stepBlocks) {
    const step = {};
    // Step type
    if (/lock/i.test(block)) step.type = 'lock';
    else if (/SUM step|aggregate/i.test(block)) step.type = 'agg';
    else if (/SORT|ORDER/i.test(block)) step.type = 'sort';
    else if (/RETRIEVE/i.test(block)) step.type = 'retrieve';
    else if (/END TRANSACTION|result/i.test(block)) step.type = 'return';
    else step.type = 'lock';

    // Confidence
    const conf = block.match(/with (no|low|moderate|high) confidence/i);
    step.confidence = conf ? conf[1].toLowerCase() : '';

    // Spool estimate
    const spool = block.match(/to be ([\d,]+) rows \(([\d,]+) bytes\)/);
    if (spool) {
      step.rows = spool[1];
      step.bytes = spool[2];
    }

    // Estimated time
    const time = block.match(/estimated time.*?([\d.]+) seconds/i);
    if (time) step.time = time[1] + 's';

    // Scan type
    if (/all-rows scan/i.test(block)) step.scanType = 'All-rows scan';
    else if (/unique PI/i.test(block)) step.scanType = 'Unique PI';
    else if (/PI columns/i.test(block)) step.scanType = 'PI access';

    // Optimizer rewrites
    step.rewrites = [];
    if (/age\s*<=\s*\d+/.test(block) && /age\s*<\s*\d+/.test(block))
      step.rewrites.push('age < N → age <= N-1 (integer boundary)');

    step.rawText = block.trim();
    steps.push(step);
  }
  return steps;
}
```

---

## Production build path

### From wireframe → surfaces-ui React artifact

1. **Convert HTML → React**: Replace `document.getElementById` with `useState`/`useRef`. Replace inline `onclick` with React event handlers. No `<form>` tags.
2. **Apply surfaces-ui tokens**: All CSS variables already match the surfaces-ui token set. Wire `var(--color-background-*)`, `var(--color-text-*)`, `var(--color-border-*)`, `var(--border-radius-*)` directly.
3. **Import lucide-react icons**: Replace Unicode icon characters with proper Lucide icons — `<Lock />`, `<Sigma />`, `<ArrowUpDown />`, `<CornerDownLeft />` etc. Already in scope at zero extra cost.
4. **Wire live EXPLAIN parsing**: Implement `parseExplain()` above. After `sendPrompt()` triggers a live EXPLAIN run, Claude's response is parsed and re-renders the workflow nodes.
5. **Add persistent storage** (optional): Use `window.storage.set/get` (artifact storage API) to persist query history across sessions.

### File outputs for this build

| File                         | Purpose                    | Status       |
| ---------------------------- | -------------------------- | ------------ |
| `visual-explain-app.html`    | Standalone HTML wireframe  | ✅ Complete  |
| `visual-explain-app-spec.md` | This document              | ✅ Complete  |
| `visual-explain-app.jsx`     | Production React component | 🔲 Next step |
| `surfaces-ui-gap-report.md`  | Design system gap report   | 🔲 Next step |

---

## surfaces-ui gap report (preview)

Four confirmed gaps — to be filed with design system team when moving to production build.

| Component                                                | Status        | Workaround used                         |
| -------------------------------------------------------- | ------------- | --------------------------------------- |
| `<CodeEditor>` with syntax highlighting                  | Not in system | `<textarea>` + `<pre>` `<mark>` overlay |
| `<WorkflowConnector>` (Pipedream-style node + connector) | Not in system | CSS border + pseudo-element arrowhead   |
| `<Collapsible>` / `<Disclosure>`                         | Not in system | Native `<details>`/`<summary>`          |
| `<SplitPane>` resizable layout                           | Not in system | CSS Grid with fixed column widths       |

---

## Pre-loaded query dataset

Three queries from the live Titanic EXPLAIN session. These serve as the demo dataset and test cases for the parser.

| Query                      | Key finding                                                   | Confidence    |
| -------------------------- | ------------------------------------------------------------- | ------------- |
| Survival by class & gender | GROUP BY raw columns, spool overestimated 126×                | No confidence |
| Age group bucketing        | CASE on single column, optimizer rewrites `< N` → `<= N-1`    | Low           |
| Family size analysis       | Arithmetic expression evaluated twice per row per CASE branch | Low           |

---

## Known issues / future work

- **Spool estimate vs actual gap visualization**: A before/after metric showing "optimizer guessed X, actual was Y" would be high-value for teaching the impact of missing stats. Requires running the query and capturing actual row counts.
- **Multi-query comparison view**: Side-by-side EXPLAIN comparison for before/after optimization. Use the `sendPrompt('Compare these two EXPLAINs...')` pattern.
- **COLLECT STATISTICS one-click**: A "Run COLLECT STATS" button that fires the actual MCP call rather than just prompting Claude about it.
- **Step timing bar**: A proportional horizontal bar showing each step's estimated time contribution — useful when steps have very different times (which doesn't happen in this demo but will in production queries).
- **Join step support**: The current parser handles single-table aggregation plans. Multi-table queries produce join steps (merge join, hash join, product join) that need additional node types and color coding.

---

_Generated from live Teradata MCP session, March 2026._
_Queries: DEMO_TitanicSurvival.Passenger_Data — 3 EXPLAIN plans analyzed._
_Step 2 deep analysis confirmed: "no confidence" = 126× spool overestimate on pclass/sex with no collected statistics._
