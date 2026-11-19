import type { DescMessage, MessageInitShape } from "@bufbuild/protobuf";
import type {
  CancelRequestSchema,
  CancelResponse,
  CountRequestSchema,
  CountResponse,
  DescribeTableRequestSchema,
  DescribeTableResponse,
  ExecuteRequestSchema,
  ExecuteResponse,
  ExplainRequestSchema,
  ExplainResponse,
  ListCatalogsRequestSchema,
  ListCatalogsResponse,
  ListFilesRequestSchema,
  ListFilesResponse,
  ListSchemasRequestSchema,
  ListSchemasResponse,
  ListSnapshotsRequestSchema,
  ListSnapshotsResponse,
  ListSourcesRequestSchema,
  ListSourcesResponse,
  ListTablesRequestSchema,
  ListTablesResponse,
  TestSourceRequestSchema,
  TestSourceResponse,
} from "@surfaces-ui/proto";

export interface CallOptions {
  /** Aborting stops the call; for `execute` it also cancels the query. */
  signal?: AbortSignal;
}

type Unary<Req extends DescMessage, Res> = (request: MessageInitShape<Req>, options?: CallOptions) => Promise<Res>;

/**
 * Everything the UI needs from a data backend, and nothing else.
 *
 * Components depend on this interface only. Any backend can implement it: the
 * Connect client in `@surfaces-ui/client-connect` (which talks to a server that
 * implements the protobuf services), `memoryDataSource` for tests and demos,
 * or a consumer's own adapter over an existing query API.
 *
 * Implementations must apply `ViewQuery` filters, sorts and paging themselves
 * and return only the requested window of rows.
 */
export interface DataSource {
  /** Streams a result: one header, then batches, then one footer. */
  execute(request: MessageInitShape<typeof ExecuteRequestSchema>, options?: CallOptions): AsyncIterable<ExecuteResponse>;
  count: Unary<typeof CountRequestSchema, CountResponse>;
  explain: Unary<typeof ExplainRequestSchema, ExplainResponse>;
  cancel: Unary<typeof CancelRequestSchema, CancelResponse>;
  listSources: Unary<typeof ListSourcesRequestSchema, ListSourcesResponse>;
  /** Checks that a source and each of its tables can be reached. Optional: a backend that cannot test leaves it out. */
  testSource?: Unary<typeof TestSourceRequestSchema, TestSourceResponse>;
  /**
   * Lists the folders and files in a source's storage: only where the source may read, and only names, sizes and dates.
   * Optional: a backend with no storage to list leaves it out, and `FileBrowser` says so.
   */
  listFiles?: Unary<typeof ListFilesRequestSchema, ListFilesResponse>;
  listCatalogs: Unary<typeof ListCatalogsRequestSchema, ListCatalogsResponse>;
  listSchemas: Unary<typeof ListSchemasRequestSchema, ListSchemasResponse>;
  listTables: Unary<typeof ListTablesRequestSchema, ListTablesResponse>;
  describeTable: Unary<typeof DescribeTableRequestSchema, DescribeTableResponse>;
  listSnapshots: Unary<typeof ListSnapshotsRequestSchema, ListSnapshotsResponse>;
}
