# `packages/components/src/text`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `Markdown` / `CodeBlock` / `HighlightedCode` | Model or human text, rendered as elements and never as HTML; code highlighted by theme tokens (JSON, SQL, TS/JS, shell, proto, YAML, CSS); an image only where the host gives its address (its description otherwise), a numbered list keeps its own numbers, and a wide table is a focusable region | `text`, `onRunSql`, `inline`, `headingStart`, `resolveLink`, `resolveImage`, `openLink` (a link the host follows in place); `code`, `language`, `onRun`, `label`, `bare` (helper: `highlight`) |
