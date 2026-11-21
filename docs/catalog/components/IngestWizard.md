# IngestWizard

Steps a person through bringing new files in: where they are, what the engine finds there, and which columns to keep, rename and retype. It writes configuration to review; it loads nothing.

## Props

- `sourceId`: string | binding | call
- `location` (optional): string — Where the files are, to start from.
- `format` (optional): "parquet" | "delta" | "iceberg" | "csv" | "json"
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.IngestWizard
  sourceId="lake"
  format="parquet"
  location="s3://acme-lake/landing/orders/*.parquet"
/>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "ingest",
  "component": "IngestWizard",
  "sourceId": "lake",
  "format": "parquet",
  "location": "s3://acme-lake/landing/orders/*.parquet"
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "ingest",
  "elements": {
    "ingest": {
      "type": "IngestWizard",
      "props": {
        "sourceId": "lake",
        "format": "parquet",
        "location": "s3://acme-lake/landing/orders/*.parquet"
      }
    }
  }
}
```
