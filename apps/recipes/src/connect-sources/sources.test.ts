import { createConnectTransport } from "@connectrpc/connect-node";
import { connectDataSource } from "@surfaces-ui/client-connect";
import { type DataSource, collect, toRows } from "@surfaces-ui/data";
import { type SurfacesServer, type TeradataSourceConfig, createSurfacesServer, envSecrets, openSources } from "@surfaces-ui/dev-server";
import { ConnectionKind, SourceKind } from "@surfaces-ui/proto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSources } from "./check-sources.js";
import config from "./surfaces.config.js";

const PASSWORD = "not-a-real-password-7f3a";
const BASIC = `Basic ${Buffer.from(`surfaces_reader:${PASSWORD}`).toString("base64")}`;

/** Every `secret` named anywhere in the config. */
function secretNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(secretNames);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, v]) => (key === "secret" && typeof v === "string" ? [v] : secretNames(v)));
}

describe("the config", () => {
  it("names each credential and holds none", () => {
    expect(secretNames(config).sort()).toEqual(["LAKE", "PG", "TD"]);
    const text = JSON.stringify(config);
    expect(text).not.toMatch(/password\s*=|"(password|token|keyId|secretKey)"/i);
    const shop = config.sources!.find((s) => s.id === "shop");
    expect(shop?.engine === "duckdb" && shop.catalogs?.[0]?.uri).toMatch(/^host=\S+ port=5432 dbname=shop user=surfaces_reader sslmode=require$/);
  });

  it("reads only paths under the S3 connection's scope", () => {
    const lake = config.sources!.find((s) => s.id === "lake");
    if (lake?.engine !== "duckdb") throw new Error("lake is a DuckDB source");
    for (const table of lake.tables) expect(lake.connections!.some((c) => table.path.startsWith(c.scope))).toBe(true);
  });

  it("finds the values under the variable names in .env.example", () => {
    const env = { PG_PASSWORD: "a", LAKE_KEY_ID: "b", LAKE_SECRET: "c", TD_PASSWORD: "d" };
    const resolve = envSecrets(env);
    expect(resolve("PG")).toMatchObject({ password: "a" });
    expect(resolve("LAKE")).toMatchObject({ keyId: "b", secret: "c" });
    expect(resolve("TD")).toMatchObject({ password: "d" });
    expect(resolve("MISSING")).toBeUndefined();
  });
});

/**
 * The Teradata source as the dev server opens it, with Query Service played
 * by a stand-in `fetch`. No Teradata system is contacted. The Postgres and
 * S3 sources are not opened here: DuckDB would install its postgres, httpfs
 * and delta extensions, which downloads them.
 */
describe("the Teradata source behind the server", () => {
  const warehouse = config.sources!.find((s): s is TeradataSourceConfig => s.id === "warehouse")!;
  const realFetch = globalThis.fetch;
  let server: SurfacesServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  /** Starts the server on a free port with only the Teradata source, and reaches it over Connect like a browser would. */
  async function start(queryService: (url: string, init: RequestInit) => Promise<Response>): Promise<DataSource> {
    vi.stubEnv("TD_PASSWORD", PASSWORD);
    vi.stubGlobal("fetch", (async (url: RequestInfo | URL, init: RequestInit = {}) =>
      String(url).startsWith(warehouse.baseUrl) ? queryService(String(url), init) : realFetch(url, init)) as typeof fetch);
    // The default resolver reads TD_PASSWORD from process.env when the source is first used.
    const sources = await openSources({ sources: [warehouse] }, process.cwd());
    server = await createSurfacesServer({ sources, discovery: false });
    const { url } = await server.listen(0);
    return connectDataSource({ transport: createConnectTransport({ baseUrl: url, httpVersion: "1.1" }) });
  }

  it("starts when Teradata cannot be reached, and says so without the password", async () => {
    const data = await start(async (_url, init) => {
      // A proxy that echoes the request in its error is the worst case: the message still must not carry the credential.
      throw new Error(`connect ECONNREFUSED (sent ${(init.headers as Record<string, string>).Authorization})`);
    });
    const { sources } = await data.listSources({});
    expect(sources.map((s) => s.id)).toEqual(["warehouse"]);

    const [report] = await checkSources(data);
    expect(report).toMatchObject({ id: "warehouse", ok: false });
    expect(report!.lines.join("\n")).toMatch(/could not be reached/);
    expect(report!.lines.join("\n")).not.toContain(PASSWORD);
    expect(report!.lines.join("\n")).not.toContain(BASIC.slice(6));
  });

  it("signs in with the password from TD_PASSWORD, and never hands it to a client", async () => {
    const seen: { url: string; authorization: string; body: Record<string, unknown> }[] = [];
    const data = await start(async (url, init) => {
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      seen.push({ url, authorization: (init.headers as Record<string, string>).Authorization!, body });
      if (url.endsWith("/sessions")) return Response.json({ sessionId: 42 });
      const sql = String(body.query ?? "");
      if (/DBCInfoV/.test(sql)) return Response.json({ results: [{ resultSet: true, columns: [{ name: "InfoData", type: "VARCHAR" }], data: [["17.20"]] }] });
      if (/DatabasesV/.test(sql)) return Response.json({ results: [{ resultSet: true, columns: [{ name: "DatabaseName", type: "VARCHAR" }], data: [["sales"]] }] });
      if (/FROM orders/.test(sql)) return Response.json({ results: [{ resultSet: true, columns: [{ name: "region", type: "VARCHAR(20)" }], data: [["Europe"], ["Asia"]] }] });
      return Response.json({ results: [{ resultSet: true, columns: [{ name: "x", type: "INTEGER" }], data: [[1]] }] });
    });

    const [report] = await checkSources(data);
    expect(report).toMatchObject({ id: "warehouse", ok: true });
    expect(report!.lines[0]).toBe("Connected (Teradata 17.20)");

    // Every request carried the credential read by secret name, and went to the configured system.
    expect(seen.length).toBeGreaterThan(0);
    for (const request of seen) {
      expect(request.authorization).toBe(BASIC);
      expect(request.url.startsWith("https://vantage.example.com:1443/systems/prod/")).toBe(true);
    }
    // The session is UTC and the default database is the configured one.
    expect(seen.map((s) => s.body.query)).toEqual(expect.arrayContaining(["SET TIME ZONE INTERVAL '00:00' HOUR TO MINUTE", 'DATABASE "sales"']));

    // A page of rows is cut by Teradata (no LIMIT/OFFSET there).
    const result = await collect(data.execute({ sourceId: "warehouse", query: { baseSql: "SELECT region FROM orders", page: { limit: 2, offset: 0n } } }));
    expect(toRows(result.table)).toEqual([{ region: "Europe" }, { region: "Asia" }]);
    const sent = String(seen.at(-1)!.body.query);
    expect(sent).toContain("SELECT region FROM orders");
    expect(sent).toMatch(/^SELECT TOP 2 /);
    expect(sent).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);

    // What a client sees names the secret, never its value.
    const { sources } = await data.listSources({});
    expect(sources[0]).toMatchObject({ id: "warehouse", kind: SourceKind.TERADATA, readOnly: true });
    expect(sources[0]!.connections).toEqual([expect.objectContaining({ name: "prod", kind: ConnectionKind.HTTP, scope: warehouse.baseUrl, credentialsSecret: "TD" })]);
    const shown = JSON.stringify(sources, (_k, v) => (typeof v === "bigint" ? String(v) : v));
    expect(shown).not.toContain(PASSWORD);
    expect(shown).not.toContain(BASIC.slice(6));
  });

  it("names the secret, not its value, when Teradata refuses the sign-in", async () => {
    const data = await start(async () => new Response(`bad credentials for ${PASSWORD}`, { status: 401 }));
    const [report] = await checkSources(data);
    expect(report!.ok).toBe(false);
    expect(report!.lines.join("\n")).toMatch(/refused the sign-in.*"TD"/);
    expect(report!.lines.join("\n")).not.toContain(PASSWORD);
  });
});
