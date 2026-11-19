import { analyticsCatalog } from "@surfaces-ui/spec";
import { seeds } from "@surfaces-ui/seeds";
import { describe, expect, it } from "vitest";
import { exampleProps } from "./catalogExamples.js";
import type { ActiveSource } from "./source.js";

const sourceFor = (id: string) => ({ sourceId: id, sampleId: "lake", sources: [{ id, table: seeds.find((s) => s.id === id)?.tables[0]?.name ?? "orders" }] }) as unknown as ActiveSource;

describe("exampleProps", () => {
  // The catalog list, the overview, the showcase and the Playground's Add all draw these, for whichever model is picked.
  it("gives every component a valid example over every sample model", () => {
    for (const seed of seeds)
      for (const name of Object.keys(analyticsCatalog.components)) {
        const props = exampleProps(name, sourceFor(seed.id));
        expect(analyticsCatalog.validateComponent({ id: "x", component: name, ...props }), `${seed.id} ${name}`).toEqual([]);
      }
  });

  it("builds pipelines, rules, personal data and cleaning plans from the picked model", () => {
    for (const name of ["PipelineGraph", "RunHistory", "PiiReview", "PlanReview", "DatasetReview"]) {
      const retail = JSON.stringify(exampleProps(name, sourceFor("retail")));
      const telco = JSON.stringify(exampleProps(name, sourceFor("telco")));
      expect(telco, name).not.toBe(retail);
    }
    const pii = exampleProps("PiiReview", sourceFor("healthcare")) as { columns: { category?: string }[] };
    expect(pii.columns.some((c) => c.category)).toBe(true);
  });
});
