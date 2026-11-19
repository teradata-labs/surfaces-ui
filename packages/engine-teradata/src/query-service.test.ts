import { EngineError } from "@surfaces-ui/engine";
import { describe, expect, it } from "vitest";
import { type QueryServiceOptions, createTeradataEngine, parseReply, queryServiceClient } from "./index.js";

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

const PASSWORD = "p@ss:w0rd-Zürich";
const BASIC = `Basic ${Buffer.from(`reader:${PASSWORD}`, "utf8").toString("base64")}`;
const json = (value: unknown, status = 200) => new Response(typeof value === "string" ? value : JSON.stringify(value), { status });
const reply = (columns: { name: string; type: string }[], data: unknown[], more = false) => ({ queueDuration: 3, queryDuration: 45, results: [{ resultSet: true, columns, data, rowCount: data.length, rowLimitExceeded: more }] });

/** A stand-in for Query Service: answers sessions itself, and queries from `answer`. */
function service(answer: (seen: Seen) => Response | Promise<Response> = () => json(reply([], [])), overrides: Partial<QueryServiceOptions> = {}) {
  const seen: Seen[] = [];
  const fake = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const request: Seen = {
      url: String(url),
      method: init?.method ?? "GET",
      headers: init?.headers as Record<string, string>,
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
    };
    seen.push(request);
    if (init?.signal?.aborted) throw new DOMException("aborted", "AbortError");
    if (request.url.endsWith("/sessions")) return json({ sessionId: 1366010, user: "reader", tdSessionNo: 1626922, createMode: "EXPLICIT", state: "LOGGINGON", autoCommit: true });
    if (request.method === "DELETE") return json("");
    return answer(request);
  }) as typeof fetch;
  const options: QueryServiceOptions = {
    baseUrl: "https://qs.example.com:1443/",
    system: "prod sys",
    user: "reader",
    secret: "TD",
    resolveSecret: (name) => (name === "TD" ? { password: PASSWORD } : undefined),
    fetch: fake,
    ...overrides,
  };
  return { client: queryServiceClient(options), options, seen, queries: () => seen.filter((s) => s.url.endsWith("/queries")) };
}

describe("Teradata Query Service transport", () => {
  it("opens one session, sets it up, then sends each statement with its values bound", async () => {
    const { client, seen } = service(() => json(reply([{ name: "region", type: "VARCHAR" }, { name: "n", type: "INTEGER" }], [["Europe", 1250], ["Asia", 900]])), { database: "sales" });
    const hostile = "Europe'; DROP TABLE orders; --";
    const result = await client.query("SELECT region, COUNT(*) AS n FROM orders WHERE region = ? AND amount >= ? GROUP BY 1", [hostile, 100n, true]);
    await client.query("SELECT 1", []);

    expect(seen.map((s) => `${s.method} ${s.url}`)).toEqual([
      "POST https://qs.example.com:1443/systems/prod%20sys/sessions",
      "POST https://qs.example.com:1443/systems/prod%20sys/queries",
      "POST https://qs.example.com:1443/systems/prod%20sys/queries",
      "POST https://qs.example.com:1443/systems/prod%20sys/queries",
      "POST https://qs.example.com:1443/systems/prod%20sys/queries",
      "POST https://qs.example.com:1443/systems/prod%20sys/queries",
    ]);
    for (const request of seen) {
      expect(request.headers).toEqual({ Accept: "application/vnd.com.teradata.rest-v1.0+json", "Content-Type": "application/json", Authorization: BASIC });
    }
    expect(seen[0]!.body).toEqual({ auto_commit: true });
    expect(seen.slice(1, 4).map((s) => [s.body!.query, s.body!.session])).toEqual([
      ["SET TIME ZONE INTERVAL '00:00' HOUR TO MINUTE", 1366010],
      ["SET QUERY_BAND = 'ApplicationName=surfaces-ui;' FOR SESSION", 1366010],
      ['DATABASE "sales"', 1366010],
    ]);
    expect(seen[4]!.body).toEqual({
      query: "SELECT region, COUNT(*) AS n FROM orders WHERE region = ? AND amount >= ? GROUP BY 1",
      format: "ARRAY",
      include_columns: true,
      include_column_types: true,
      date_format: "ISO_8601",
      row_limit: 250000,
      // One array of values for one run of the statement; no boolean or bigint in Teradata or JSON.
      params: [[hostile, 100, 1]],
      session: 1366010,
    });
    expect(String(seen[4]!.body!.query)).not.toContain("DROP");
    expect(seen[5]!.body).not.toHaveProperty("params");
    expect(result).toEqual({ columns: [{ name: "region", type: "VARCHAR" }, { name: "n", type: "INTEGER" }], rows: [["Europe", 1250], ["Asia", 900]], truncated: false });
  });

  it("signs in with a JWT when the secret holds a token, and needs no user", async () => {
    const { client, seen } = service(undefined, { user: undefined, resolveSecret: () => ({ token: "eyJ.header.sig" }), session: "implicit" });
    await client.query("SELECT 1", []);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.headers.Authorization).toBe("Bearer eyJ.header.sig");
    // With no session of its own, the query band travels with the request.
    expect(seen[0]!.body).toMatchObject({ query: "SELECT 1", query_bands: { ApplicationName: "surfaces-ui" } });
    expect(seen[0]!.body).not.toHaveProperty("session");
  });

  it("can spell request fields as the usage guide does", async () => {
    const { client, queries } = service(undefined, { keyStyle: "camel", session: "implicit", rowLimit: 500 });
    await client.query("SELECT 1 WHERE 1 = ?", [1]);
    expect(queries()[0]!.body).toEqual({ query: "SELECT 1 WHERE 1 = ?", format: "ARRAY", includeColumns: true, rowLimit: 500, params: [[1]], queryBands: { ApplicationName: "surfaces-ui" } });
  });

  it("reads rows sent as objects, results with no rows, and statements with no result", async () => {
    const objects = service(() => json({ results: [{ resultSet: true, data: [{ InfoKey: "VERSION", InfoData: "17.20" }] }] }), { session: "implicit" });
    expect(await objects.client.query("SELECT * FROM DBC.DBCInfoV", [])).toEqual({ columns: [{ name: "InfoKey", type: "" }, { name: "InfoData", type: "" }], rows: [["VERSION", "17.20"]], truncated: false });
    const empty = service(() => json(reply([{ name: "id", type: "INTEGER" }], [])), { session: "implicit" });
    expect(await empty.client.query("SELECT id FROM t WHERE 1 = 0", [])).toEqual({ columns: [{ name: "id", type: "INTEGER" }], rows: [], truncated: false });
    const none = service(() => json({ queueDuration: 1, queryDuration: 2, results: [{ resultSet: false, rowCount: 0 }] }), { session: "implicit" });
    expect(await none.client.query("SET QUERY_BAND = NONE FOR SESSION", [])).toEqual({ columns: [], rows: [] });
  });

  it("keeps every digit of large numbers in a reply", async () => {
    expect(parseReply('{"a":9007199254740993,"b":12345678901234.56,"c":1.5,"d":42,"e":-9223372036854775808,"f":"9007199254740993"}')).toEqual({
      a: 9007199254740993n,
      b: "12345678901234.56",
      c: 1.5,
      d: 42,
      e: -9223372036854775808n,
      f: "9007199254740993",
    });
    const { client } = service(() => json('{"results":[{"resultSet":true,"columns":[{"name":"id","type":"BIGINT"},{"name":"amount","type":"DECIMAL(18,2)"}],"data":[[9007199254740993,12345678901234.56]]}]}'), { session: "implicit" });
    const engine = await createTeradataEngine({ client });
    const result = await engine.execute("SELECT id, amount FROM t", []);
    for await (const batch of result.batches) {
      expect(batch.getChildAt(0)!.get(0)).toBe(9007199254740993n);
      const words = batch.getChildAt(1)!.get(0) as Uint32Array;
      expect(words.reduce((sum, word, i) => sum | (BigInt(word) << BigInt(32 * i)), 0n)).toBe(1234567890123456n);
    }
  });

  it("reports when the row limit cut a result short, and the engine refuses it", async () => {
    const { client } = service(() => json(reply([{ name: "n", type: "INTEGER" }], [[1], [2]], true)), { session: "implicit", rowLimit: 2 });
    expect((await client.query("SELECT n FROM t", [])).truncated).toBe(true);
    await expect((await createTeradataEngine({ client })).execute("SELECT n FROM t", [])).rejects.toThrow(/more than 2 rows/);
  });

  it("maps a database error (status 420) by its number", async () => {
    const failing = (error: string, message: string) => service(() => json({ error, message }, 420), { session: "implicit" }).client.query("SELECT * FROM missing", []);
    await expect(failing("3807", "[Teradata Database] [TeraJDBC 17.20.00.15] [Error 3807] [SQLState 42S02] Object 'missing' does not exist.")).rejects.toMatchObject({
      code: "UNKNOWN_TABLE",
      engineCode: "3807",
      message: "Object 'missing' does not exist.",
    });
    await expect(failing("3706", "Syntax error: expected something between the word 'orders' and the 'WHER' keyword.")).rejects.toMatchObject({ code: "SYNTAX", engineCode: "3706" });
    await expect(failing("3523", "The user does not have SELECT access to hr.salaries.")).rejects.toMatchObject({ code: "ENGINE", engineCode: "3523" });
    await expect(failing("2646", "No more spool space in reader.")).rejects.toMatchObject({ code: "ENGINE", engineCode: "2646" });
  });

  it("reports the service's own errors and an error found while reading rows", async () => {
    const bad = service(() => json({ message: "Missing or invalid query request." }, 400), { session: "implicit" });
    await expect(bad.client.query("SELECT 1", [])).rejects.toMatchObject({ code: "ENGINE", engineCode: "400", message: "Missing or invalid query request." });
    const gateway = service(() => json("<html>Bad gateway</html>", 502), { session: "implicit" });
    await expect(gateway.client.query("SELECT 1", [])).rejects.toMatchObject({ code: "ENGINE", engineCode: "502" });
    const late = service(() => json({ results: [], responseError: { error: "2646", message: "No more spool space in reader." } }), { session: "implicit" });
    await expect(late.client.query("SELECT 1", [])).rejects.toMatchObject({ engineCode: "2646" });
    const garbled = service(() => json("{not json"), { session: "implicit" });
    await expect(garbled.client.query("SELECT 1", [])).rejects.toThrow(/could not be read/);
  });

  it("opens a new session once when the service no longer knows the one it had", async () => {
    let first = true;
    const { client, seen } = service((request) => {
      if (first && request.body!.query === "SELECT 1") {
        first = false;
        return json({ message: "Session not found." }, 404);
      }
      return json(reply([{ name: "x", type: "INTEGER" }], [[1]]));
    });
    expect((await client.query("SELECT 1", [])).rows).toEqual([[1]]);
    expect(seen.filter((s) => s.url.endsWith("/sessions"))).toHaveLength(2);
  });

  it("closes the session it opened", async () => {
    const { client, seen } = service();
    await client.close!();
    expect(seen).toEqual([]);
    await client.query("SELECT 1", []);
    await client.close!();
    expect(seen.at(-1)).toMatchObject({ method: "DELETE", url: "https://qs.example.com:1443/systems/prod%20sys/sessions/1366010" });
  });

  it("reports a cancelled request as cancelled", async () => {
    const { client } = service(undefined, { session: "implicit" });
    const stop = new AbortController();
    stop.abort();
    await expect(client.query("SELECT 1", [], { signal: stop.signal })).rejects.toMatchObject({ code: "CANCELLED" });
  });
});

describe("credentials", () => {
  const leaks = (text: string) => text.includes(PASSWORD) || text.includes(BASIC.slice(6)) || text.includes("eyJ.header.sig");

  it("never lets the password, the header or a token into what is thrown", async () => {
    const echo = (status: number) => (request: Seen) => json({ error: "8017", message: `The UserId, Password or Account is invalid. Header was ${request.headers.Authorization}; password ${PASSWORD}` }, status);
    const cases: Promise<unknown>[] = [
      service(echo(420), { session: "implicit" }).client.query("SELECT 1", []),
      service(echo(401), { session: "implicit" }).client.query("SELECT 1", []),
      service(echo(500), { session: "implicit" }).client.query("SELECT 1", []),
      service((request) => json(`<html>${request.headers.Authorization}</html>`, 502), { session: "implicit" }).client.query("SELECT 1", []),
      service(() => {
        throw new TypeError(`fetch failed for https://reader:${PASSWORD}@qs.example.com (${BASIC})`);
      }, { session: "implicit" }).client.query("SELECT 1", []),
      service((request) => json({ results: [], responseError: `Bad token ${request.headers.Authorization}` }), { session: "implicit", resolveSecret: () => ({ token: "eyJ.header.sig" }) }).client.query("SELECT 1", []),
      // Through the engine, including the catalog and the connection test.
      createTeradataEngine({ ...service(echo(420), { session: "implicit" }).options }).then((engine) => engine.execute("SELECT 1", [])),
      createTeradataEngine({ ...service(echo(420), { session: "implicit" }).options }).then((engine) => engine.listTables({ catalog: "", schema: "", search: "" })),
    ];
    for (const pending of cases) {
      const error = await pending.then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(EngineError);
      expect(leaks((error as Error).message), (error as Error).message).toBe(false);
      expect(leaks(JSON.stringify(error))).toBe(false);
      expect(leaks(String((error as Error).stack))).toBe(false);
    }
    const checks = await (await createTeradataEngine({ ...service(echo(420), { session: "implicit" }).options })).check!();
    expect(checks.every((c) => !c.ok && !leaks(c.message))).toBe(true);
    expect(checks[0]!.message).toContain("***");
  });

  it("says which secret is missing by name, and that a password needs a user", async () => {
    const unset = service(undefined, { resolveSecret: () => undefined, session: "implicit" });
    await expect(unset.client.query("SELECT 1", [])).rejects.toThrow('The secret "TD" is not set on the server. Set TD_PASSWORD, or TD_TOKEN for a JWT.');
    expect(unset.seen).toEqual([]);
    const nobody = service(undefined, { user: undefined, session: "implicit" });
    await expect(nobody.client.query("SELECT 1", [])).rejects.toThrow(/needs a user/);
  });

  it("takes a secret's name, and has no option that takes a password", async () => {
    const { options } = service();
    expect(Object.keys(options)).not.toContain("password");
    // @ts-expect-error a password is not an option
    const withPassword: QueryServiceOptions = { ...options, password: "x" };
    expect(JSON.stringify(await createTeradataEngine(options).then((engine) => engine.connections))).not.toContain(PASSWORD);
    void withPassword;
  });
});
