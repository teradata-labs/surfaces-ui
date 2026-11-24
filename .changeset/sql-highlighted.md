---
"@surfaces-ui/components": patch
"@surfaces-ui/chat": patch
---

Every SQL statement is highlighted, read-only or not. `QueryResult`'s SQL sent, `ModelDiagram`'s SQL for the model and `AskData`'s proposed SQL are `CodeBlock`s (with Copy) instead of plain text, and the two places a person edits SQL use `SqlEditor`: the query a semantic model is written as (`SemanticModelEditor`) and the SQL in an editable approval (`ApprovalCard`).
