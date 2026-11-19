import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnectTransport } from "@connectrpc/connect-node";
import { connectDataSource, connectForms } from "@surfaces-ui/client-connect";
import { type DataSource, type Forms, collect, formDefinitions, toRows } from "@surfaces-ui/data";
import { type SurfacesServer, createSurfacesServer, openSources, serverOptions } from "@surfaces-ui/dev-server";
import { create } from "@bufbuild/protobuf";
import { type FormFieldSpec, formDefinition } from "@surfaces-ui/components";
import { type FormDefinition, FormDefinitionSchema, SubmitRequestSchema } from "@surfaces-ui/proto";
import { analyticsCatalog, pageMessages, validatePage } from "@surfaces-ui/spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writebackConfig } from "./config.js";
import { storeVisitPage } from "./page.js";

let store: string;
let server: SurfacesServer;
let url: string;
let forms: Forms;
let data: DataSource;

const plain = (value: unknown) => JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
const lines = () => fs.readFileSync(path.join(store, "forms", "store-visit.jsonl"), "utf8").split("\n").filter(Boolean);

beforeAll(async () => {
  store = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-writeback-"));
  const config = writebackConfig(store);
  server = await createSurfacesServer(await serverOptions(config, await openSources(config, store), store));
  ({ url } = await server.listen(0));
  const transport = createConnectTransport({ baseUrl: url, httpVersion: "1.1" });
  forms = connectForms({ transport });
  data = connectDataSource({ transport });
}, 60_000);

afterAll(async () => {
  await server?.close();
  if (store) fs.rmSync(store, { recursive: true, force: true });
});

describe("the page", () => {
  it("is valid against the catalog, as a page and as A2UI messages", () => {
    expect(validatePage(storeVisitPage, analyticsCatalog)).toEqual([]);
    for (const message of pageMessages(storeVisitPage)) expect(analyticsCatalog.validateMessage(message)).toEqual([]);
  });

  it("checks the same rules the server will", () => {
    const form = storeVisitPage.components.find((c) => c.component === "Form")!;
    const [server] = formDefinitions(writebackConfig(store).forms!);
    // Help text may differ between the two; the rules may not.
    const rules = (definition: FormDefinition) => definition.fields.map(({ name, label, type, required, options, min, max, maxLength, pattern }) => ({ name, label, type, required, options, min, max, maxLength, pattern }));
    expect(form.formId).toBe(server!.id);
    expect(rules(formDefinition(String(form.formId), form.fields as FormFieldSpec[]))).toEqual(rules(create(FormDefinitionSchema, server)));
  });
});

describe("submitting", () => {
  it("stores a good submission, and the forms source reads it back", async () => {
    const response = await forms.submit({
      formId: "store-visit",
      values: { store: "York", visited_on: "2026-11-12", rating: "4", note: "Shelves restocked." },
      idempotencyKey: "visit-1",
    });
    expect(response.fieldErrors).toEqual([]);
    // As stored: the rating is a number now, and fields left blank are null.
    expect(response.submission?.values).toEqual({ store: "York", visited_on: "2026-11-12", rating: 4, follow_up: null, note: "Shelves restocked." });

    // The same key again stores nothing new.
    const again = await forms.submit({ formId: "store-visit", values: { store: "York", visited_on: "2026-11-12", rating: 4 }, idempotencyKey: "visit-1" });
    expect(again.submission?.id).toBe(response.submission?.id);
    expect(lines()).toHaveLength(1);

    const { submissions } = await forms.listSubmissions({ formId: "store-visit" });
    expect(submissions.map((s) => s.id)).toEqual([response.submission!.id]);

    // Read back through the read-only DataSource, filtered and sorted in SQL like any table.
    const result = await collect(
      data.execute({
        sourceId: "forms",
        query: { baseSql: "SELECT id, values.store AS store, CAST(values.visited_on AS DATE) AS visited_on, values.rating AS rating FROM store_visits ORDER BY submittedAt DESC" },
      }),
    );
    expect(plain(toRows(result.table))).toEqual([{ id: response.submission!.id, store: "York", visited_on: Date.UTC(2026, 10, 12), rating: 4 }]);
  });

  it("refuses bad values with a reason per field, and stores nothing", async () => {
    const bad = await forms.submit({ formId: "store-visit", values: { store: "Paris", visited_on: "2026-02-30", rating: 9 } });
    expect(bad.submission).toBeUndefined();
    expect(Object.fromEntries(bad.fieldErrors.map((e) => [e.field, e.message]))).toEqual({
      store: "Choose one of: Leeds, York, Hull.",
      visited_on: "That date does not exist.",
      rating: "Must be at most 5.",
    });
    const missing = await forms.submit({ formId: "store-visit", values: {} });
    expect(missing.fieldErrors.map((e) => e.field).sort()).toEqual(["rating", "store", "visited_on"]);
    expect(lines()).toHaveLength(1);
  });

  it("refuses a form the server does not define", async () => {
    for (const formId of ["no-such-form", "../../etc/passwd", "store_visits"]) {
      const response = await forms.submit({ formId, values: { store: "York" } });
      expect(response.submission).toBeUndefined();
      expect(response.message).toMatch(/^No form/);
    }
    expect(fs.readdirSync(path.join(store, "forms"))).toEqual(["store-visit.jsonl"]);
  });
});

describe("what a client can send", () => {
  it("has no field for SQL, a table or a path", () => {
    expect(SubmitRequestSchema.fields.map((f) => f.name)).toEqual(["form_id", "values", "surface_id", "idempotency_key"]);
    // A form's definition says where data goes only as text for people to read.
    expect(FormDefinitionSchema.fields.map((f) => f.name)).toEqual(["id", "title", "description", "fields", "target"]);
  });

  it("treats SQL or a table in the values as unknown fields", async () => {
    const response = await forms.submit({
      formId: "store-visit",
      values: { store: "York", visited_on: "2026-11-12", rating: 3, table: "orders", sql: "DELETE FROM store_visits" },
    });
    expect(response.submission).toBeUndefined();
    expect(response.fieldErrors.map((e) => [e.field, e.message])).toEqual([
      ["table", "This form has no such field."],
      ["sql", "This form has no such field."],
    ]);
    expect(lines()).toHaveLength(1);
  });

  it("drops fields the contract does not have from a hand-made request", async () => {
    const response = await fetch(`${url}/surfaces.v1.FormService/Submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: "store-visit", values: { store: "York", visited_on: "2026-11-12", rating: 3 }, table: "orders", sql: "DROP TABLE orders" }),
    });
    // The server reads only the fields SubmitRequest declares; the rest never reach the form.
    expect(response.ok).toBe(true);
    const { submission } = (await response.json()) as { submission: { values: Record<string, unknown> } };
    expect(submission.values).toEqual({ store: "York", visited_on: "2026-11-12", rating: 3, follow_up: null, note: null });
    expect(lines()).toHaveLength(2);
    expect(lines()[1]).not.toMatch(/orders|DROP/);
  });

  it("cannot write through the forms source", async () => {
    await expect(collect(data.execute({ sourceId: "forms", query: { baseSql: "DELETE FROM store_visits" } }))).rejects.toThrow();
    await expect(collect(data.execute({ sourceId: "forms", query: { baseSql: "COPY store_visits TO 'elsewhere.csv'" } }))).rejects.toThrow();
  });
});
