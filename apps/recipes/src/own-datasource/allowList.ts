import { create } from "@bufbuild/protobuf";
import type { DataSource } from "@surfaces-ui/data";
import { ListSourcesResponseSchema } from "@surfaces-ui/proto";

/**
 * Wraps any DataSource so only some sources can be reached through it. Every
 * call that names a source is checked; `listSources` leaves the rest out.
 * This is a convenience for one page, not security: your server must still
 * decide what each user may read.
 */
export function withSourceAllowList(dataSource: DataSource, allowed: string[]): DataSource {
  const ok = new Set(allowed);
  const check = (sourceId: string | undefined) => {
    if (!ok.has(sourceId ?? "")) throw new Error(`The source "${sourceId ?? ""}" is not available here.`);
  };
  return {
    ...dataSource,
    async *execute(request, options) {
      check(request.sourceId);
      yield* dataSource.execute(request, options);
    },
    count: async (request, options) => (check(request.sourceId), dataSource.count(request, options)),
    explain: async (request, options) => (check(request.sourceId), dataSource.explain(request, options)),
    listCatalogs: async (request, options) => (check(request.sourceId), dataSource.listCatalogs(request, options)),
    listSchemas: async (request, options) => (check(request.sourceId), dataSource.listSchemas(request, options)),
    listTables: async (request, options) => (check(request.sourceId), dataSource.listTables(request, options)),
    describeTable: async (request, options) => (check(request.sourceId), dataSource.describeTable(request, options)),
    listSnapshots: async (request, options) => (check(request.sourceId), dataSource.listSnapshots(request, options)),
    async listSources(request, options) {
      const reply = await dataSource.listSources(request, options);
      return create(ListSourcesResponseSchema, { sources: reply.sources.filter((s) => ok.has(s.id)) });
    },
    testSource: dataSource.testSource && (async (request, options) => {
      // Only a check of a named source is allowed; a test of a new, unsaved source is refused.
      if (request.target?.case !== "id") throw new Error("Only saved sources can be tested here.");
      check(request.target.value);
      return dataSource.testSource!(request, options);
    }),
  };
}
