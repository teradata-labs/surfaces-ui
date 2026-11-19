# ConnectionBuilder

`import { ConnectionBuilder } from "@surfaces-ui/components";`

Sets up Parquet, Delta or Iceberg data on S3, GCS, Azure, https or disk, and writes the configuration for the server with the names of the environment variables to set. It holds the name of a secret, never a credential.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `value` | object | yes | The connection being set up. |

## Callbacks

- `onChange`: Every change to the connection, as the whole draft. Required: the host holds the draft.

## Example

```tsx
<ConnectionBuilder
  value={{"sourceId":"lake","storage":"s3","scope":"s3://acme-lake/sales","credentials":"secret","secret":"LAKE","region":"eu-west-1","endpoint":"","tables":[{"name":"orders","format":"delta","path":"s3://acme-lake/sales/orders"}],"catalogUri":"","catalogWarehouse":""}}
  onChange={…}
/>
```
