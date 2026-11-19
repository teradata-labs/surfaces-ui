import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnectTransport } from "@connectrpc/connect-node";
import { connectDataSource, connectForms, connectPipelines, connectSemantics, connectSurfaceLibrary } from "@surfaces-ui/client-connect";
import { type Forms, SemanticModelError, StaleSemanticModelError, StaleSurfaceError, type SurfaceLibrary, collect, toRows } from "@surfaces-ui/data";
import { SurfaceKind } from "@surfaces-ui/proto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openSources, serverOptions } from "./config.js";
import { type SurfacesServer, createSurfacesServer } from "./server.js";

let server: SurfacesServer;
let store: string;
let forms: Forms;
let library: SurfaceLibrary;
let transport: ReturnType<typeof createConnectTransport>;

beforeAll(async () => {
  store = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-stores-"));
  const config = {
    seeds: true,
    discovery: { storeDir: store },
    forms: [{ id: "feedback", title: "Feedback", fields: [{ name: "score", label: "Score", type: "integer" as const, required: true, min: 1, max: 5 }] }],
  };
  server = await createSurfacesServer(await serverOptions(config, await openSources(config, store), store));
  const { url } = await server.listen(0);
  transport = createConnectTransport({ baseUrl: url, httpVersion: "1.1" });
  forms = connectForms({ transport });
  library = connectSurfaceLibrary({ transport });
}, 120_000);
afterAll(async () => {
  await server?.close();
  if (store) fs.rmSync(store, { recursive: true, force: true });
});

describe("seeds", () => {
  it("serves the six industry models when seeds are on", async () => {
    const data = connectDataSource({ transport });
    const { sources } = await data.listSources({});
    expect(sources.map((s) => s.id).sort()).toEqual(["fraud", "healthcare", "manufacturing", "retail", "telco", "transportation"]);
    const result = await collect(data.execute({ sourceId: "retail", query: { baseSql: "SELECT count(*) AS n FROM orders" } }));
    expect(Number(toRows(result.table)[0]!.n)).toBeGreaterThan(0);
  });

  it("offers each seed's pipeline", async () => {
    const { pipelines } = await connectPipelines({ transport }).listPipelines({});
    expect(pipelines.map((p) => p.id)).toContain("retail-sales");
    expect(pipelines).toHaveLength(6);
  });
});

describe("semantic models", () => {
  it("serves each seed's starter models, checks a save against the data, and keeps it as a file", async () => {
    const semantics = connectSemantics({ transport });
    const retail = (await semantics.listSemanticModels({ sourceId: "retail" })).models.map((m) => m.name);
    expect(retail).toContain("sales_lines");
    expect((await semantics.listSemanticModels({})).models.map((m) => m.sourceId)).toEqual(expect.arrayContaining(["healthcare", "fraud", "telco", "transportation", "manufacturing"]));
    const { model } = await semantics.getSemanticModel({ name: "sales_lines" });
    expect(model?.metrics.map((m) => m.name)).toContain("refund_rate");

    // A field over a column the query does not return is refused, and says why.
    const wrong = { ...model!, dimensions: [...model!.dimensions, { $typeName: "surfaces.v1.Dimension" as const, name: "colour", label: "Colour", column: "colour", kind: 1, grain: "", description: "", definedBy: "Ana" }] };
    await expect(semantics.saveSemanticModel({ model: wrong, expectedVersion: model!.version })).rejects.toThrow(/"colour"/);
    await expect(semantics.saveSemanticModel({ model: wrong, expectedVersion: model!.version })).rejects.toBeInstanceOf(SemanticModelError);
    // A query that writes is refused by the read-only source.
    await expect(semantics.saveSemanticModel({ model: { ...model!, sql: "DELETE FROM orders" }, expectedVersion: model!.version })).rejects.toThrow(/does not run/);

    const saved = await semantics.saveSemanticModel({ model: { ...model!, metrics: [...model!.metrics, { $typeName: "surfaces.v1.Metric" as const, name: "cost_share", label: "Cost share", expression: "cost / revenue", format: "percent", description: "", definedBy: "Ana" }], savedBy: "Ana" }, expectedVersion: model!.version, note: "Added cost share" });
    expect(saved.model?.version).toBe(model!.version + 1);
    await expect(semantics.saveSemanticModel({ model: model!, expectedVersion: model!.version })).rejects.toBeInstanceOf(StaleSemanticModelError);
    const file = JSON.parse(fs.readFileSync(path.join(store, "semantic", "sales_lines.json"), "utf8"));
    expect(file.at(-1).note).toBe("Added cost share");
    expect(file.at(-1).model.metrics.at(-1)).toMatchObject({ name: "cost_share", expression: "cost / revenue", definedBy: "Ana" });
  });
});

describe("forms", () => {
  it("lists configured and seed forms", async () => {
    const { forms: all } = await forms.listForms({});
    expect(all.map((f) => f.id)).toEqual(expect.arrayContaining(["feedback", "retail-store-visit"]));
    expect(all.find((f) => f.id === "retail-store-visit")?.target).toBe("retail.store_visits");
  });

  it("keeps a valid submission in a JSON-lines file and lists it", async () => {
    const response = await forms.submit({ formId: "feedback", values: { score: "4" }, idempotencyKey: "a" });
    expect(response.fieldErrors).toEqual([]);
    expect(response.submission?.values).toEqual({ score: 4 });
    const file = path.join(store, "forms", "feedback.jsonl");
    expect(fs.readFileSync(file, "utf8").trim().split("\n")).toHaveLength(1);
    const again = await forms.submit({ formId: "feedback", values: { score: "4" }, idempotencyKey: "a" });
    expect(again.submission?.id).toBe(response.submission?.id);
    expect(fs.readFileSync(file, "utf8").trim().split("\n")).toHaveLength(1);
    const { submissions } = await forms.listSubmissions({ formId: "feedback" });
    expect(submissions.map((s) => s.id)).toEqual([response.submission?.id]);
  });

  it("refuses bad values and unknown forms, storing nothing", async () => {
    const bad = await forms.submit({ formId: "feedback", values: { score: "nine", extra: "x" } });
    expect(bad.submission).toBeUndefined();
    expect(bad.fieldErrors.map((e) => e.field).sort()).toEqual(["extra", "score"]);
    const unknown = await forms.submit({ formId: "../../etc/passwd", values: {} });
    expect(unknown.submission).toBeUndefined();
    expect(unknown.message).toMatch(/No form/);
    expect(fs.readdirSync(path.join(store, "forms"))).toEqual(["feedback.jsonl"]);
  });
});

describe("saved surfaces", () => {
  const document = { title: "Orders", root: "root", components: [{ id: "root", component: "Text", text: "Orders" }] };

  it("saves as a file, versions, and refuses a stale save", async () => {
    const first = await library.saveSurface({ surface: { id: "orders-page", kind: SurfaceKind.DASHBOARD, title: "Orders", document } });
    expect(first.surface?.version).toBe(1);
    expect(fs.existsSync(path.join(store, "surfaces", "orders-page.json"))).toBe(true);
    const second = await library.saveSurface({ surface: { id: "orders-page", kind: SurfaceKind.DASHBOARD, title: "Orders v2", document }, expectedVersion: 1 });
    expect(second.surface?.version).toBe(2);
    await expect(library.saveSurface({ surface: { id: "orders-page", title: "Late", document }, expectedVersion: 1 })).rejects.toBeInstanceOf(StaleSurfaceError);
    const { versions } = await library.listSurfaceVersions({ id: "orders-page" });
    expect(versions).toHaveLength(2);
    const { surfaces } = await library.listSurfaces({ kind: SurfaceKind.DASHBOARD });
    expect(surfaces.map((s) => s.title)).toEqual(["Orders v2"]);
  });

  it("deletes the file", async () => {
    await library.deleteSurface({ id: "orders-page" });
    expect(fs.existsSync(path.join(store, "surfaces", "orders-page.json"))).toBe(false);
    await expect(library.getSurface({ id: "orders-page" })).rejects.toThrow(/No saved surface/);
  });
});
