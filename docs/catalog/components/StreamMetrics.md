# StreamMetrics

How a streaming query is keeping up: input and processing rates, batch size and duration, with recent trends. Give the progress reports oldest first, as reported.

## Props

- `progress`: array of { timestamp: string, numInputRows: number, inputRowsPerSecond: number, processedRowsPerSecond: number, batchDurationMs: number, stateRows?: number }
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.StreamMetrics
  progress={[{ timestamp: "2026-11-12T10:00:00Z", numInputRows: 500, inputRowsPerSecond: 50, processedRowsPerSecond: 80, batchDurationMs: 900 }]}
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "stream",
  "component": "StreamMetrics",
  "progress": [
    {
      "timestamp": "2026-11-12T10:00:00Z",
      "numInputRows": 500,
      "inputRowsPerSecond": 50,
      "processedRowsPerSecond": 80,
      "batchDurationMs": 900
    }
  ]
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "stream",
  "elements": {
    "stream": {
      "type": "StreamMetrics",
      "props": {
        "progress": [
          {
            "timestamp": "2026-11-12T10:00:00Z",
            "numInputRows": 500,
            "inputRowsPerSecond": 50,
            "processedRowsPerSecond": 80,
            "batchDurationMs": 900
          }
        ]
      }
    }
  }
}
```
