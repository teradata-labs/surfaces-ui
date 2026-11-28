import { describe, expect, it } from "vitest";
import { configFromEnv } from "./config.js";

describe("configFromEnv", () => {
  it("is nothing when nothing is set, so the sample data is served", () => {
    expect(configFromEnv({})).toBeUndefined();
  });

  it("makes one source from a command, handing the connection string over by name and never keeping it in the config", () => {
    const env: Record<string, string | undefined> = { SURFACES_SOURCE_DIALECT: "Teradata", SURFACES_SOURCE_SERVER: "uvx teradata-mcp-server --profile 'data scientist'", SURFACES_SOURCE_SECRET: "teradata://u:p@host/db", SURFACES_SOURCE_NAME: "Warehouse" };
    const config = configFromEnv(env)!;
    expect(config.sources).toEqual([{ id: "data", displayName: "Warehouse", engine: "mcp", dialect: "teradata", database: undefined, server: { command: "uvx", args: ["teradata-mcp-server", "--profile", "data scientist"], env: ["DATABASE_URI"] } }]);
    expect(env.DATABASE_URI).toBe("teradata://u:p@host/db");
    expect(JSON.stringify(config)).not.toContain("u:p@host");
    const named: Record<string, string | undefined> = { SURFACES_SOURCE_DIALECT: "mysql", SURFACES_SOURCE_SERVER: "npx -y some-mysql-server", SURFACES_SOURCE_SECRET: "pw", SURFACES_SOURCE_SECRET_NAME: "MYSQL_PASS" };
    expect(configFromEnv(named)!.sources![0]).toMatchObject({ server: { env: ["MYSQL_PASS"] } });
    expect(named.MYSQL_PASS).toBe("pw");
  });

  it("makes one source from an address, with the token kept out of the config", () => {
    const config = configFromEnv({ SURFACES_SOURCE_DIALECT: "postgres", SURFACES_SOURCE_SERVER: "https://data.example.com/mcp", SURFACES_SOURCE_SECRET: "tok" })!;
    expect(config.sources![0]).toMatchObject({ engine: "mcp", dialect: "postgres", server: { url: "https://data.example.com/mcp", secret: "SURFACES_SOURCE_SECRET" } });
    expect(JSON.stringify(config)).not.toContain("tok\"");
  });

  it("says what is missing or wrong", () => {
    expect(() => configFromEnv({ SURFACES_SOURCE_DIALECT: "postgres" })).toThrow(/the server is missing/);
    expect(() => configFromEnv({ SURFACES_SOURCE_SERVER: "uvx x" })).toThrow(/the database type is missing/);
    expect(() => configFromEnv({ SURFACES_SOURCE_DIALECT: "sybase", SURFACES_SOURCE_SERVER: "uvx x" })).toThrow(/must be postgres, mysql, duckdb or teradata/);
    expect(() => configFromEnv({ SURFACES_SOURCE_DIALECT: "postgres", SURFACES_SOURCE_SERVER: "uvx x", SURFACES_SOURCE_SECRET_NAME: "A B" })).toThrow(/plain environment variable name/);
  });
});
