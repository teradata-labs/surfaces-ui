import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { siteMetadata, siteParams, siteProblems } from "@surfaces-ui/next";
import { describe, expect, it } from "vitest";
import { essays, site } from "./site.js";

const here = import.meta.dirname;

describe("a Next.js site from Surfaces pages", () => {
  it("has a route for every page and an address for every essay", async () => {
    expect(siteProblems(site)).toEqual([]);
    const params = await siteParams(site, { "/essays/[slug]": () => essays.map((e) => e.slug) });
    expect(params).toEqual([{ route: [] }, { route: ["essays"] }, ...essays.map((e) => ({ route: ["essays", e.slug] }))]);
  });

  it("titles an essay from its own text", async () => {
    const meta = await siteMetadata(site, Promise.resolve({ route: ["essays", "one-number"] }), {
      describe: (_, { slug }) => ({ title: essays.find((e) => e.slug === slug)?.title }),
    });
    expect(meta.title).toBe("One number · Field notes");
  });

  // A real `next build` with static export takes about a minute, so it runs when asked: SURFACES_TEST_NEXT=1.
  it.runIf(process.env.SURFACES_TEST_NEXT)(
    "builds with Next.js as static HTML, each page drawn on the server",
    () => {
      // Inside apps/recipes, so the app finds `next` and the workspace's packages in node_modules.
      const app = path.resolve(here, "../../.next-build");
      fs.rmSync(app, { recursive: true, force: true });
      fs.mkdirSync(app, { recursive: true });
      for (const name of ["app", "site.ts", "next.config.mjs"]) fs.cpSync(path.join(here, name), path.join(app, name), { recursive: true });
      execFileSync(path.resolve(here, "../../node_modules/.bin/next"), ["build"], { cwd: app, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: "pipe" });

      const read = (route: string) => fs.readFileSync(path.join(app, "out", route, "index.html"), "utf8");
      const home = read("");
      expect(home).toContain("<title>Field notes</title>");
      expect(home).toMatch(/<h1[^>]*>Field notes<\/h1>/);
      expect(home).toContain('href="/essays"');
      for (const essay of essays) {
        const html = read(`essays/${essay.slug}`);
        expect(html).toContain(`<title>${essay.title} · Field notes</title>`);
        expect(html).toMatch(new RegExp(`<h1[^>]*>${essay.title}</h1>`));
        expect(html).toContain(`<link rel="canonical" href="/essays/${essay.slug}"/>`);
        // The theme is in the first HTML, not added once scripts run.
        expect(html).toContain("--sf-color-bg");
      }
      expect(read("essays/one-number")).toContain("<em>comparison</em>");
    },
    300_000,
  );
});
