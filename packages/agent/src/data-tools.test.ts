import { memoryDataSource, memorySemantics } from "@surfaces-ui/data";
import { AggregateFunction } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { dataTools } from "./data-tools.js";

const data = memoryDataSource({ sourceId: "shop", tables: { orders: [{ order_id: 1, amount: 9.5 }], customers: [{ customer_id: 1, full_name: "Ada" }] } });

describe("dataTools", () => {
  it("lists tables and describes one by names and types only, never values", async () => {
    const [list, describeTable] = dataTools(data);
    expect(((await list!.run({ sourceId: "shop" })) as { tables: { table: string }[] }).tables.map((t) => t.table).sort()).toEqual(["customers", "orders"]);
    const described = await describeTable!.run({ sourceId: "shop", table: "customers" });
    expect(described).toMatchObject({ table: "customers", columns: [{ name: "customer_id" }, { name: "full_name" }] });
    expect(JSON.stringify(described)).not.toContain("Ada");
  });

  it("lists and describes semantic models when given them, by definition and never by value", async () => {
    const semantics = memorySemantics({
      models: [
        {
          name: "orders",
          label: "Orders",
          sourceId: "shop",
          sql: "SELECT * FROM orders",
          measures: [
            { name: "revenue", label: "Revenue", column: "amount", aggregate: AggregateFunction.SUM, format: "currency", definedBy: "Ana" },
            { name: "orders", label: "Orders", aggregate: AggregateFunction.COUNT },
          ],
          metrics: [{ name: "per_order", label: "Revenue per order", expression: "revenue / orders", format: "currency" }],
        },
      ],
    });
    const tools = dataTools(data, { semantics });
    expect(tools.map((t) => t.name)).toEqual(["list_tables", "describe_table", "list_semantic_models", "describe_semantic_model"]);
    expect(await tools[2]!.run({ sourceId: "shop" })).toMatchObject({ models: [{ name: "orders", measures: 2, metrics: 1 }] });
    expect(await tools[3]!.run({ name: "orders" })).toMatchObject({
      sql: "SELECT * FROM orders",
      measures: [{ name: "revenue", aggregate: "sum", column: "amount", definedBy: "Ana" }, { name: "orders", aggregate: "count" }],
      metrics: [{ name: "per_order", expression: "revenue / orders" }],
    });
    // A model over a source the agent was not given stays out of reach.
    await expect(dataTools(data, { sourceIds: ["other"], semantics })[3]!.run({ name: "orders" })).rejects.toThrow(/Unknown source/);
  });

  it("refuses a source it was not given", async () => {
    const [list] = dataTools(data, { sourceIds: ["other"] });
    await expect(list!.run({ sourceId: "shop" })).rejects.toThrow(/Unknown source/);
  });
});
