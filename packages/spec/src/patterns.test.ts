import { describe, expect, it } from "vitest";
import { analyticsCatalog } from "./analytics.js";
import { patternDocs, patternMessages, patterns } from "./patterns.js";
import { applyMessages } from "./surface.js";

describe("patterns", () => {
  it("has unique ids", () => {
    expect(new Set(patterns.map((p) => p.id)).size).toBe(patterns.length);
  });

  for (const pattern of patterns) {
    it(`${pattern.id} is a valid surface with a root and no dangling children`, () => {
      const messages = patternMessages(pattern);
      for (const message of messages) expect(analyticsCatalog.validateMessage(message)).toEqual([]);
      const surface = applyMessages({}, messages).main!;
      expect(surface.components.root).toBeTruthy();
      for (const component of pattern.components) {
        for (const child of (component.children as string[] | undefined) ?? []) expect(surface.components[child], `${component.id} -> ${child}`).toBeTruthy();
      }
    });

    it(`${pattern.id} ends in a decision a person makes`, () => {
      expect(pattern.components.some((c) => c.action !== undefined)).toBe(true);
    });
  }

  it("marks every step that removes or replaces data as high risk", () => {
    const steps = patterns.flatMap((p) => p.components.filter((c) => c.component === "PlanReview").flatMap((c) => c.steps as { affects?: string; risk?: string }[]));
    for (const step of steps.filter((s) => /left out|removed|Replaces/.test(s.affects ?? ""))) expect(step.risk).toBe("high");
  });

  it("writes the patterns as a page", () => {
    expect(patternDocs()).toContain("## Review personal data");
  });
});
