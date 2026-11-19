import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type PageDocument, analyticsCatalog, validatePage } from "@surfaces-ui/spec";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./cli.js";

const made: string[] = [];
function tempDir(name: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "create-surfaces-"));
  made.push(root);
  return path.join(root, name);
}
afterEach(() => {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("createApp", () => {
  it("writes a runnable app: template files, .gitignore, title, scripts and dependencies", () => {
    const dir = tempDir("My Sales_app");
    const pkg = createApp({ dir, log: () => {} });
    for (const file of [".gitignore", "index.html", "surfaces.config.ts", "vite.config.ts", "src/App.tsx", "src/dashboard.ts"]) {
      expect(fs.existsSync(path.join(dir, file)), file).toBe(true);
    }
    expect(fs.existsSync(path.join(dir, "_gitignore"))).toBe(false);
    expect(fs.readFileSync(path.join(dir, "index.html"), "utf8")).not.toContain("__TITLE__");
    expect(pkg).toMatchObject({ name: "my-sales_app", private: true, scripts: { dev: "vite", serve: "surfaces-dev" } });
    const deps = pkg.dependencies as Record<string, string>;
    expect(Object.keys(deps)).toEqual(expect.arrayContaining(["@surfaces-ui/chat", "@surfaces-ui/components", "@surfaces-ui/dev-server", "@surfaces-ui/agent-anthropic", "@anthropic-ai/sdk", "react"]));
    expect(pkg.overrides).toBeUndefined();
    expect(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))).toEqual(pkg);
  });

  it("refuses a folder that already has files in it", () => {
    const dir = tempDir("taken");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "keep.txt"), "mine");
    expect(() => createApp({ dir, log: () => {} })).toThrow(/not empty/);
    expect(fs.readdirSync(dir)).toEqual(["keep.txt"]);
  });

  it("starts with a dashboard the catalog accepts", async () => {
    // Imported by path so the template stays outside this package's compiled sources.
    const file = path.resolve(import.meta.dirname, "../template/src/dashboard.ts");
    const { dashboard } = (await import(file)) as { dashboard: PageDocument };
    expect(validatePage(dashboard, analyticsCatalog)).toEqual([]);
  });
});
