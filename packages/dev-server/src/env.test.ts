import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadEnvFile } from "./env.js";

describe("loadEnvFile", () => {
  it("sets what the file holds, keeps what the environment already has, and reports names only", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-env-"));
    fs.writeFileSync(path.join(dir, ".env.local"), '# keys\nANTHROPIC_API_KEY=sk-test-file\nSURFACES_AGENT="claude"\nEMPTY=\n');
    const env: NodeJS.ProcessEnv = { SURFACES_AGENT: "local" };
    const result = loadEnvFile(dir, env);
    expect(env.ANTHROPIC_API_KEY).toBe("sk-test-file");
    expect(env.SURFACES_AGENT).toBe("local");
    expect(env.EMPTY).toBeUndefined();
    expect(result.names).toEqual(["ANTHROPIC_API_KEY"]);
    expect(JSON.stringify(result)).not.toContain("sk-test-file");
  });

  it("does nothing when there is no file", () => {
    const env: NodeJS.ProcessEnv = {};
    expect(loadEnvFile(fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-env-")), env)).toEqual({ names: [] });
    expect(env).toEqual({});
  });
});
