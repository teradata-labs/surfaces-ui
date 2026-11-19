import { memoryDataSource } from "@surfaces-ui/data";
import { CertificationStatus, ContextFormat, DescriptionOrigin, ObjectKind, RelationKind, SearchMode } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { type Embedder, type LanguageModel, createDiscovery } from "./index.js";

const data = () =>
  memoryDataSource({
    sourceId: "shop",
    tables: {
      orders: Array.from({ length: 40 }, (_, i) => ({ order_id: i + 1, customer_id: (i % 7) + 1, status: i % 5 === 0 ? null : ["shipped", "pending"][i % 2], amount: i * 2.5 })),
      customers: Array.from({ length: 7 }, (_, i) => ({ customer_id: i + 1, full_name: `Person ${i}`, email: `p${i}@example.com` })),
      orders_archive: [{ order_id: 0, customer_id: 1, status: "shipped", amount: 1 }],
      web_sessions: [{ session_id: "a", page_views: 3 }],
    },
  });
const table = (name: string) => ({ sourceId: "shop", kind: ObjectKind.TABLE, table: name });
const names = (hits: { object?: { name: string } }[]) => hits.map((h) => h.object?.name);

// Stands in for an embedding model: buckets a few related words into the same dimension.
const CONCEPTS = [["order", "orders", "purchase", "purchases", "sale", "sales"], ["customer", "customers", "buyer", "buyers", "client", "person"], ["session", "sessions", "visit", "visits", "traffic", "web"]];
const fakeEmbedder: Embedder = {
  id: "fake",
  embed: async (texts) =>
    texts.map((text) => {
      const words = text.toLowerCase().split(/[^a-z]+/);
      return Float32Array.from(CONCEPTS.map((group) => (words.some((w) => group.includes(w)) ? 1 : 0)));
    }),
};

describe("search", () => {
  it("ranks by keyword, explains matches, and falls back when there are no embeddings", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const result = await discovery.search({ query: "order amount", mode: SearchMode.HYBRID });
    expect(result.modeUsed).toBe(SearchMode.KEYWORD);
    expect(names(result.hits)[0]).toBe("orders.amount");
    expect(names(result.hits)).toContain("orders");
    const orders = result.hits.find((h) => h.object?.name === "orders")!;
    expect(orders.reasons).toEqual(["Name matches “order”", "Has column order_id, amount"]);
    expect(result.hits[0]!.score).toBe(1);
    expect(names((await discovery.search({ query: "cust", kinds: [ObjectKind.TABLE] })).hits)).toContain("customers");
    expect((await discovery.search({ query: "zzzz" })).hits).toEqual([]);
  });

  it("finds by meaning when an embedder is present", async () => {
    const discovery = createDiscovery({ dataSource: data(), embedder: fakeEmbedder });
    const keyword = await discovery.search({ query: "buyers", mode: SearchMode.KEYWORD, kinds: [ObjectKind.TABLE] });
    expect(keyword.hits).toEqual([]);
    const semantic = await discovery.search({ query: "buyers", kinds: [ObjectKind.TABLE] });
    expect(semantic.modeUsed).toBe(SearchMode.HYBRID);
    expect(names(semantic.hits)[0]).toBe("customers");
    expect(semantic.hits[0]!.reasons[0]).toMatch(/Similar in meaning/);
    expect(names((await discovery.search({ query: "site traffic", mode: SearchMode.SEMANTIC, kinds: [ObjectKind.TABLE] })).hits)).toEqual(["web_sessions"]);
  });

  it("answers about one source while another is still being indexed", async () => {
    const shop = data();
    const slow = memoryDataSource({ sourceId: "warehouse", tables: { facts: [{ fact_id: 1 }] } });
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Two sources behind one backend; the warehouse's listing does not finish until released, as a large catalog takes minutes.
    const both = {
      ...shop,
      listSources: async () => ({ sources: [...(await shop.listSources({})).sources, ...(await slow.listSources({})).sources] }),
      listTables: async (r: { sourceId: string }) => (r.sourceId === "warehouse" ? held.then(() => slow.listTables(r as never)) : shop.listTables(r as never)),
      describeTable: (r: { sourceId: string }) => (r.sourceId === "warehouse" ? slow.describeTable(r as never) : shop.describeTable(r as never)),
    } as unknown as typeof shop;
    const discovery = createDiscovery({ dataSource: both });
    const warming = discovery.warm();
    expect(names((await discovery.search({ query: "orders", sourceIds: ["shop"], kinds: [ObjectKind.TABLE] })).hits)).toContain("orders");
    expect((await discovery.getObject({ ref: table("orders") })).profile?.object?.name).toBe("orders");
    expect((await discovery.getRelated({ ref: table("orders") })).relations.length).toBeGreaterThan(0);
    // A search over every source waits for all of them.
    let everywhere: string[] | undefined;
    const all = discovery.search({ query: "facts", kinds: [ObjectKind.TABLE] }).then((r) => {
      everywhere = names(r.hits) as string[];
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(everywhere).toBeUndefined();
    release();
    await all;
    expect(everywhere).toEqual(["facts"]);
    expect((await warming).objects).toBeGreaterThan(0);
  });

  it("puts an object whose own name matches before one that matches only through its table", async () => {
    const discovery = createDiscovery({ dataSource: data(), embedder: fakeEmbedder });
    const hits = names((await discovery.search({ query: "customer" })).hits);
    expect(hits[0]).toBe("customers");
    expect(hits.indexOf("customers.customer_id")).toBeLessThan(hits.indexOf("customers.email"));
  });

  it("browses and pages with no query", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const first = await discovery.search({ query: "", pageSize: 3 });
    expect(names(first.hits)).toEqual(["customers", "orders", "orders_archive"]);
    expect(first.total).toBe(4n);
    expect(names((await discovery.search({ query: "", pageSize: 3, pageToken: first.nextPageToken })).hits)).toEqual(["web_sessions"]);
  });
});

describe("profiles and sample values", () => {
  it("withholds values by default but still reports counts", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const { profile } = await discovery.getObject({ ref: table("orders"), includeProfile: true });
    expect(profile?.sampleValuesAllowed).toBe(false);
    expect(profile?.rowCount).toBe(40n);
    const status = profile!.columns.find((c) => c.name === "status")!;
    expect(status).toMatchObject({ nullCount: 8n, distinctCount: 2n, sampleValuesWithheld: true, topValues: [] });
    expect(status.min).toBeUndefined();
  });

  it("shows ranges and top values for sources that allow it", async () => {
    const discovery = createDiscovery({ dataSource: data(), allowSampleValues: ["shop"] });
    const { profile } = await discovery.getObject({ ref: table("orders"), includeProfile: true });
    const status = profile!.columns.find((c) => c.name === "status")!;
    expect(status.sampleValuesWithheld).toBe(false);
    expect(status.topValues.map((t) => [t.value, t.count])).toEqual([["pending", 16n], ["shipped", 16n], ["(empty)", 8n]]);
    expect(profile!.columns.find((c) => c.name === "amount")).toMatchObject({ min: "0", max: "97.5" });
  });
});

describe("relations", () => {
  it("infers joins from key-like shared columns and similarity from overlap", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const { relations } = await discovery.getRelated({ ref: table("orders") });
    const join = relations.find((r) => r.kind === RelationKind.JOIN && r.object?.name === "customers")!;
    expect(join.keys.map((k) => [k.leftColumn, k.rightColumn])).toEqual([["customer_id", "customer_id"]]);
    expect(join.inferred).toBe(true);
    expect(relations.find((r) => r.kind === RelationKind.SIMILAR)?.object?.name).toBe("orders_archive");
    expect(relations.some((r) => r.object?.name === "web_sessions")).toBe(false);
    expect((await discovery.getRelated({ ref: table("orders"), kinds: [RelationKind.SIMILAR] })).relations).toHaveLength(1);
  });

  it("reports declared foreign keys as facts, from either side, instead of a guess", async () => {
    const base = data();
    // orders.customer_id references customers.customer_id, as a source with keys would report it.
    const withKeys = {
      ...base,
      describeTable: async (request: Parameters<typeof base.describeTable>[0]) => {
        const response = await base.describeTable(request);
        if (response.table && request.ref?.table === "orders") response.table.foreignKeys = [{ columns: ["customer_id"], references: { table: "customers" }, referencedColumns: ["customer_id"] } as never];
        return response;
      },
    };
    const discovery = createDiscovery({ dataSource: withKeys });
    const fromOrders = (await discovery.getRelated({ ref: table("orders"), kinds: [RelationKind.JOIN] })).relations.filter((r) => r.object?.name === "customers");
    expect(fromOrders).toHaveLength(1);
    expect(fromOrders[0]).toMatchObject({ inferred: false, confidence: 1, reason: "Declared key: customer_id" });
    const fromCustomers = (await discovery.getRelated({ ref: table("customers"), kinds: [RelationKind.JOIN] })).relations.find((r) => r.object?.name === "orders")!;
    expect(fromCustomers.inferred).toBe(false);
    expect(fromCustomers.keys.map((k) => [k.leftColumn, k.rightColumn])).toEqual([["customer_id", "customer_id"]]);
  });
});

describe("descriptions and questions", () => {
  it("labels placeholder output and stores only what a person accepts", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const proposal = await discovery.describe({ ref: table("customers") });
    expect(proposal.generatedBy).toBe("placeholder");
    expect(proposal.description).toBe("Table customers (7 rows) with 3 columns: customer_id, full_name, email.");
    expect((await discovery.getObject({ ref: table("customers") })).profile?.object?.description).toBe("");
    await discovery.saveDescription({ ref: table("customers"), description: "People who have bought something.", origin: DescriptionOrigin.HUMAN });
    const saved = (await discovery.getObject({ ref: table("customers") })).profile?.object;
    expect(saved).toMatchObject({ description: "People who have bought something.", descriptionOrigin: DescriptionOrigin.HUMAN });
    expect(names((await discovery.search({ query: "bought" })).hits)).toEqual(["customers"]);

    let text = "";
    const cited: string[] = [];
    let by = "";
    for await (const message of discovery.ask({ question: "how many orders per customer?" })) {
      if (message.part.case === "textDelta") text += message.part.value;
      if (message.part.case === "citation") cited.push(message.part.value.object!.name);
      if (message.part.case === "done") by = message.part.value.generatedBy;
    }
    expect(by).toBe("placeholder");
    expect(text).toMatch(/No language model is connected/);
    expect(cited).toContain("orders");
  });

  it("uses a language model when given one, sending metadata but no data values", async () => {
    const prompts: string[] = [];
    const model: LanguageModel = {
      id: "test-model",
      async *complete(prompt) {
        prompts.push(prompt);
        if (prompt.includes("Reply with JSON")) yield '{"description": "Customer orders.", "columns": {"amount": "Order total"}}';
        else {
          yield "Use orders. ";
          yield "```sql\nSELECT COUNT(*) FROM orders\n```";
        }
      },
    };
    const discovery = createDiscovery({ dataSource: data(), languageModel: model, allowSampleValues: ["shop"] });
    const proposal = await discovery.describe({ ref: table("orders"), includeColumns: true });
    expect(proposal).toMatchObject({ description: "Customer orders.", columnDescriptions: { amount: "Order total" }, generatedBy: "test-model" });
    let sql = "";
    for await (const message of discovery.ask({ question: "count orders" })) if (message.part.case === "done") sql = message.part.value.suggestedSql;
    expect(sql).toBe("SELECT COUNT(*) FROM orders");
    expect(prompts.join("\n")).toContain("- amount");
    expect(prompts.join("\n")).not.toMatch(/shipped|pending|example\.com/);
  });
});

describe("context packs", () => {
  const pack = {
    name: "Order analysis",
    notes: "Amounts are in USD.",
    definitions: { AOV: "Average order value" },
    items: [
      { ref: table("orders"), columns: ["order_id", "amount"], note: "One row per order.", includeSampleRows: true },
      { ref: table("customers") },
      { ref: table("missing") },
    ],
    joins: [{ left: table("orders"), right: table("customers"), keys: [{ leftColumn: "customer_id", rightColumn: "customer_id" }] }],
  };

  it("renders markdown without data values unless the source allows them", async () => {
    const closed = await createDiscovery({ dataSource: data() }).renderContextPack({ target: { case: "pack", value: pack } });
    expect(closed.containsSampleValues).toBe(false);
    expect(closed.text).toContain("# Data context: Order analysis");
    expect(closed.text).toContain("- **AOV**: Average order value");
    expect(closed.text).toContain("| amount | Float64 |  |");
    expect(closed.text).not.toContain("| status |");
    expect(closed.text).toContain("Sample rows withheld");
    expect(closed.text).toContain("- orders ⋈ customers ON orders.customer_id = customers.customer_id");
    expect(closed.missing.map((m) => m.table)).toEqual(["missing"]);
    expect(closed.tokenEstimate).toBe(Math.ceil(closed.text.length / 4));

    const open = await createDiscovery({ dataSource: data(), allowSampleValues: ["shop"] }).renderContextPack({ target: { case: "pack", value: pack } });
    expect(open.containsSampleValues).toBe(true);
    expect(open.text).toContain("| 1 | 0 |");
  });

  it("saves versions, lists, renders JSON by id, and deletes", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const saved = (await discovery.saveContextPack({ pack })).pack!;
    expect(saved.id).toMatch(/^order-analysis-[a-z0-9]+$/);
    expect(saved.version).toBe(1);
    expect((await discovery.saveContextPack({ pack: { ...pack, id: saved.id } })).pack?.version).toBe(2);
    expect((await discovery.listContextPacks({})).packs).toMatchObject([{ name: "Order analysis", itemCount: 3, version: 2 }]);
    const json = JSON.parse((await discovery.renderContextPack({ target: { case: "id", value: saved.id }, format: ContextFormat.JSON })).text);
    expect(json.tables.map((t: { table: string }) => t.table)).toEqual(["orders", "customers"]);
    expect(json.tables[0].columns).toHaveLength(2);
    await discovery.deleteContextPack({ id: saved.id });
    expect((await discovery.listContextPacks({})).packs).toEqual([]);
    await expect(discovery.saveContextPack({ pack: { name: " " } })).rejects.toThrow(/needs a name/);
  });
});

describe("certification", () => {
  it("records who certified an object, ranks it first, and tells the agent", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const before = await discovery.search({ query: "orders", kinds: [ObjectKind.TABLE] });
    expect(names(before.hits).slice(0, 2)).toEqual(["orders", "orders_archive"]);

    await expect(discovery.setCertification({ ref: table("orders_archive"), status: CertificationStatus.CERTIFIED })).rejects.toThrow(/who/);
    const saved = await discovery.setCertification({
      ref: table("orders_archive"),
      status: CertificationStatus.CERTIFIED,
      setBy: "Data platform",
      note: "Reconciled with finance.",
    });
    expect(saved.object?.certification).toMatchObject({ status: CertificationStatus.CERTIFIED, setBy: "Data platform" });
    await discovery.setCertification({ ref: table("orders"), status: CertificationStatus.DEPRECATED, setBy: "Data platform", note: "Use orders_archive." });

    const after = await discovery.search({ query: "orders", kinds: [ObjectKind.TABLE] });
    expect(names(after.hits).slice(0, 2)).toEqual(["orders_archive", "orders"]);
    expect(names((await discovery.search({ query: "", certificationStatuses: [CertificationStatus.CERTIFIED] })).hits)).toEqual(["orders_archive"]);
    expect(names((await discovery.search({ query: "" })).hits)[0]).toBe("orders_archive");

    const rendered = await discovery.renderContextPack({
      target: { case: "pack", value: { name: "p", items: [{ ref: table("orders_archive") }, { ref: table("orders") }] } },
      format: ContextFormat.MARKDOWN,
    });
    expect(rendered.text).toContain("Certified by Data platform: Reconciled with finance.");
    expect(rendered.text).toContain("Deprecated by Data platform; avoid using it. Use orders_archive.");

    const cleared = await discovery.setCertification({ ref: table("orders"), status: CertificationStatus.UNSPECIFIED });
    expect(cleared.object?.certification).toBeUndefined();
  });

  it("marks distinct counts as estimates", async () => {
    const discovery = createDiscovery({ dataSource: data() });
    const profile = (await discovery.getObject({ ref: table("orders"), includeProfile: true })).profile!;
    expect(profile.columns.find((c) => c.name === "customer_id")).toMatchObject({ distinctCount: 7n, distinctCountEstimated: true });
  });
});
