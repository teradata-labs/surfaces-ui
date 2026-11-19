# Bring your own backend (DataSource)

Every component reads data through one interface, `DataSource`. If you already have a query API, write an adapter for it and install no data-layer package: no engine, no dev server, no Connect client. This recipe adapts a plain HTTP API that answers with Arrow, and adds a small wrapper that limits which sources a page can reach.

What your server has to do:

- Take the `ViewQuery` and apply it: filters, sorts, column selection, grouping, aggregates, buckets, samples and the page. Components send a new `ViewQuery` whenever a person sorts, filters or scrolls, and expect back only that window of rows. The adapter never sorts or filters in the browser; it forwards the request and decodes the reply.
- Bind filter values as parameters. They arrive as typed values in `Filter.values`, never as SQL text.
- Treat the base SQL as untrusted and run it read-only.
- Answer a failed query with a JSON body. A `message` is enough; `code`, `line` and `column` let `SqlEditor` mark the place.

The wire format here is a choice, not a rule:

| Call | Request | Reply |
|---|---|---|
| `POST /query` | the `ExecuteRequest` as protobuf JSON | an Arrow IPC stream; `x-truncated: true` when rows were left out, `x-executed-sql` (percent-encoded) for "show SQL" |
| `POST /count`, `/sources`, `/catalogs`, `/schemas`, `/tables`, `/describe` | the request as protobuf JSON | the response as protobuf JSON |
| any failure | | a non-2xx status with `{ message, code?, line?, column? }` |

Protobuf JSON is what `toJson` and `fromJson` from `@bufbuild/protobuf` write and read. Enums are written as names (`"SORT_DIRECTION_DESC"`) and 64-bit integers as strings (`"offset": "200"`), so any server language can read it without the generated code.

The adapter:

{{file: httpDataSource.ts}}

`execute` reads the Arrow reply whole and then hands it to components as the header, batch and footer parts they expect, using `encodeTable` from `@surfaces-ui/data`. Since the server sends only one window at a time, that is a few hundred rows, not the whole result. If your server streams large replies, read the body as it arrives instead and yield each batch as it is decoded.

What it does not do, and says so: it has no query plan (`explain` throws a readable error, which `QueryPlan` shows), no time travel (a request for it is refused), no snapshots, and no separate cancel call. Aborting the signal a component passes to `execute` stops the request. `testSource` is left out, which the interface allows.

A wrapper can sit in front of any `DataSource`. This one refuses calls for sources a page should not reach and leaves them out of `listSources`. It is a convenience, not security: your server still decides what each user may read.

{{file: allowList.ts}}

Use it like any other backend:

```tsx
const data = withSourceAllowList(
  httpDataSource({ baseUrl: "/api/analytics", headers: async () => ({ authorization: `Bearer ${await session.token()}` }) }),
  ["shop"],
);

<DataSourceProvider dataSource={data}>
  <QueryResult sourceId="shop" sql="SELECT * FROM orders" />
</DataSourceProvider>
```

The test plays the server with a stand-in `fetch` that runs each request on `memoryDataSource` and answers in the format above. It checks that the filters, sorts and page reach the server in the request body, that only the requested rows come back, that a real `DataGrid` works through the adapter, and that each kind of failure reads as a plain message. It has not been run against a real HTTP server.

{{file: httpDataSource.test.tsx}}
