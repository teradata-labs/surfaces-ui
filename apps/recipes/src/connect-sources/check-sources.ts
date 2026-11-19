import { type DataSource, queryErrorInfo } from "@surfaces-ui/data";

export interface SourceReport {
  id: string;
  ok: boolean;
  /** One line per table, catalog or check, in words a person can act on. */
  lines: string[];
}

/**
 * Asks the server to reach every source it has and says what worked. A
 * source that cannot be reached is reported, not thrown, so one broken
 * connection does not hide the state of the others.
 */
export async function checkSources(data: DataSource): Promise<SourceReport[]> {
  const { sources } = await data.listSources({});
  return Promise.all(
    sources.map(async (source): Promise<SourceReport> => {
      if (!data.testSource) return { id: source.id, ok: false, lines: ["This backend cannot test sources."] };
      try {
        const result = await data.testSource({ target: { case: "id", value: source.id } });
        return {
          id: source.id,
          ok: result.ok,
          lines: [result.engineVersion ? `${result.message} (${result.engineVersion})` : result.message, ...result.checks.map((c) => `${c.ok ? "ok" : "failed"}: ${c.name}: ${c.message}`)],
        };
      } catch (error) {
        // A source that cannot be reached comes back as a failed result; this catches the rest (the data server itself being down).
        return { id: source.id, ok: false, lines: [queryErrorInfo(error).message] };
      }
    }),
  );
}
