# ObjectInfo

`import { ObjectInfo } from "@surfaces-ui/components";`

What the backend knows about a database, schema or table: its kind, format, size, columns and keys. Names only, never values.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `sourceId` | string | yes | The source to ask. |
| `catalog` | string |  | A catalog (database). |
| `schema` | string |  |  |
| `table` | string |  | With a table, it describes the table; without, the schema or catalog. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `dataSource`: **Its own data source.** Left out, the one from `DataSourceProvider`.

## Callbacks

- `onClose`: Shows a close button.

## Example

```tsx
<ObjectInfo onClose={…} />
```
