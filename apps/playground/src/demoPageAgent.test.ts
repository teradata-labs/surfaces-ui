import { memoryDataSource } from "@surfaces-ui/data";
import { describe, expect, it } from "vitest";
import { demoPageAgent, demoPageStarters } from "./demoPageAgent.js";
import { focusFor } from "./focus.js";

describe("demoPageAgent", () => {
  it("charts the dataset's measure by month, not a count of the first table", async () => {
    const dataSource = memoryDataSource({
      sourceId: "sample",
      tables: { orders: [{ ordered_at: new Date("2026-01-03T00:00:00Z"), region: "EU", status: "paid", amount: 12.5, order_id: 1 }] },
    });
    const focus = focusFor("sample", "orders");
    const starter = demoPageStarters(focus)[0]!;
    expect(starter).toBe("Add a line chart of revenue by month");
    const page = [{ id: "root", component: "Column", children: [] }];
    const prompt = `Change the page "main"\nInstruction: ${starter}\n${JSON.stringify(page)}`;
    const components: Record<string, unknown>[] = [];
    for await (const event of demoPageAgent(dataSource, focus).send({ sessionId: "", input: { case: "text", value: prompt } })) {
      const part = event.event;
      if (part.case === "surface") components.push(...((part.value as { updateComponents?: { components: Record<string, unknown>[] } }).updateComponents?.components ?? []));
    }
    const chart = components.find((c) => c.component === "Chart");
    expect(chart).toMatchObject({ type: "line", x: "ordered_at", xGrain: "month", y: [{ column: "amount", aggregate: "sum", label: "Revenue" }] });
  });
});
