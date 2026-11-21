import { create } from "@bufbuild/protobuf";
import { FieldType, FormDefinitionSchema, SurfaceKind } from "@surfaces-ui/proto";
import { describe, expect, it } from "vitest";
import { checkSubmission, fieldAsked, formDefinitions, memoryForms } from "./forms.js";
import { memorySurfaceLibrary, StaleSurfaceError } from "./library.js";

const form = {
  id: "case-review",
  title: "Review a case",
  target: "fraud",
  fields: [
    { name: "case_id", label: "Case", type: FieldType.TEXT, required: true, pattern: "C-\\d+" },
    { name: "amount", label: "Amount", type: FieldType.NUMBER, min: 0 },
    { name: "count", label: "Count", type: FieldType.INTEGER },
    { name: "decision", label: "Decision", type: FieldType.CHOICE, required: true, options: ["fraud", "not fraud"] },
    { name: "confirmed", label: "Confirmed", type: FieldType.BOOLEAN },
    { name: "on", label: "On", type: FieldType.DATE },
    { name: "at", label: "At", type: FieldType.DATETIME },
  ],
};

describe("a field that waits on another", () => {
  const [spec] = formDefinitions([
    {
      id: "source",
      fields: [
        { name: "kind", label: "Source", type: "choice", options: ["Table", "Website"], required: true },
        { name: "table", label: "Table name", type: "text", required: true, visibleWhen: { field: "kind", equals: "Table" } },
        { name: "url", label: "URL", type: "text", required: true, pattern: "https?://.+", visibleWhen: { field: "kind", equals: "Website" } },
        { name: "depth", label: "Depth", type: "integer", visibleWhen: { field: "url" } },
      ],
    },
  ]);
  const waiting = create(FormDefinitionSchema, spec!);
  const field = (name: string) => waiting.fields.find((f) => f.name === name)!;

  it("is asked for only while the other holds what it waits for", () => {
    expect(fieldAsked(waiting, field("kind"), {})).toBe(true);
    expect(fieldAsked(waiting, field("table"), {})).toBe(false);
    expect(fieldAsked(waiting, field("table"), { kind: "Table" })).toBe(true);
    expect(fieldAsked(waiting, field("url"), { kind: "Table" })).toBe(false);
    // With no value named, anything there will do; and a field waiting on one that is not asked for is not asked for either.
    expect(fieldAsked(waiting, field("depth"), { kind: "Website", url: "https://example.com" })).toBe(true);
    expect(fieldAsked(waiting, field("depth"), { kind: "Table", url: "https://example.com" })).toBe(false);
  });

  it("is not required, and stores nothing, while it is not asked for", () => {
    const table = checkSubmission(waiting, { kind: "Table", table: "docs.articles", url: "left over" });
    expect(table.errors).toEqual([]);
    expect(table.values).toEqual({ kind: "Table", table: "docs.articles", url: null, depth: null });
    expect(checkSubmission(waiting, { kind: "Website" }).errors.map((e) => e.field)).toEqual(["url"]);
    expect(checkSubmission(waiting, { kind: "Website", url: "ftp://x" }).errors.map((e) => e.message)).toEqual(["Not in the expected format."]);
  });

  it("is refused in config when it names no other field", () => {
    expect(() => formDefinitions([{ id: "f", fields: [{ name: "a", label: "A", type: "text", visibleWhen: { field: "b" } }] }])).toThrow(/waits on "b"/);
    expect(() => formDefinitions([{ id: "f", fields: [{ name: "a", label: "A", type: "text", visibleWhen: { field: "a" } }] }])).toThrow(/waits on "a"/);
  });
});

describe("checkSubmission", () => {
  const definition = create(FormDefinitionSchema, form);

  it("normalises good values", () => {
    const out = checkSubmission(definition, { case_id: "C-12", amount: "12.5", count: 3, decision: "fraud", confirmed: "true", on: "2026-02-28", at: "2026-02-28T10:00:00+01:00" });
    expect(out.errors).toEqual([]);
    expect(out.values).toEqual({ case_id: "C-12", amount: 12.5, count: 3, decision: "fraud", confirmed: true, on: "2026-02-28", at: "2026-02-28T09:00:00.000Z" });
  });

  it("names every field that is wrong", () => {
    const out = checkSubmission(definition, { case_id: "x", amount: -1, count: 1.5, decision: "maybe", on: "2026-02-30", extra: 1 });
    expect(Object.fromEntries(out.errors.map((e) => [e.field, e.message]))).toEqual({
      extra: "This form has no such field.",
      case_id: "Not in the expected format.",
      amount: "Must be at least 0.",
      count: "Enter a whole number.",
      decision: "Choose one of: fraud, not fraud.",
      on: "That date does not exist.",
    });
  });

  it("requires required fields and stores blanks as null", () => {
    const out = checkSubmission(definition, { case_id: " ", decision: "fraud" });
    expect(out.errors.map((e) => e.message)).toEqual(["Case is required."]);
    expect(checkSubmission(definition, { case_id: "C-1", decision: "fraud" }).values.amount).toBeNull();
  });
});

describe("memoryForms", () => {
  it("stores valid submissions once per key, newest first", async () => {
    const forms = memoryForms({ forms: [form], now: () => new Date("2026-01-01T00:00:00Z") });
    const first = await forms.submit({ formId: "case-review", values: { case_id: "C-1", decision: "fraud" }, idempotencyKey: "k1" });
    expect(first.submission?.values).toMatchObject({ case_id: "C-1", decision: "fraud" });
    const again = await forms.submit({ formId: "case-review", values: { case_id: "C-1", decision: "fraud" }, idempotencyKey: "k1" });
    expect(again.submission?.id).toBe(first.submission?.id);
    await forms.submit({ formId: "case-review", values: { case_id: "C-2", decision: "not fraud" } });
    const list = await forms.listSubmissions({ formId: "case-review" });
    expect(list.submissions.map((s) => s.values?.case_id)).toEqual(["C-2", "C-1"]);
  });

  it("stores nothing when a field is wrong, and refuses unknown forms", async () => {
    const forms = memoryForms({ forms: [form] });
    const bad = await forms.submit({ formId: "case-review", values: { case_id: "C-1" } });
    expect(bad.submission).toBeUndefined();
    expect(bad.fieldErrors.map((e) => e.field)).toEqual(["decision"]);
    expect((await forms.submit({ formId: "nope", values: {} })).message).toMatch(/No form/);
    expect(forms.submissions()).toEqual([]);
  });
});

describe("memorySurfaceLibrary", () => {
  const doc = { id: "p", title: "Sales", catalogId: "x", components: [] };

  it("saves, versions, lists by kind and rejects stale saves", async () => {
    const data: Record<string, string> = {};
    const storage = { load: (k: string) => data[k], save: (k: string, v: string) => void (data[k] = v) };
    const lib = memorySurfaceLibrary({ storage });
    const saved = (await lib.saveSurface({ surface: { title: "Sales by region", kind: SurfaceKind.CHART, document: doc, tags: ["retail"] } })).surface;
    expect(saved?.id).toBe("sales-by-region");
    expect(saved?.version).toBe(1);
    await lib.saveSurface({ surface: { id: saved!.id, kind: saved!.kind, title: "Sales by region (v2)", document: doc, tags: ["retail"] }, expectedVersion: 1, note: "renamed" });
    await expect(lib.saveSurface({ surface: { id: saved!.id, title: saved!.title, document: doc }, expectedVersion: 1 })).rejects.toBeInstanceOf(StaleSurfaceError);
    await lib.saveSurface({ surface: { title: "Orders form", kind: SurfaceKind.FORM, document: doc } });

    expect((await lib.listSurfaces({ kind: SurfaceKind.CHART })).surfaces.map((s) => s.title)).toEqual(["Sales by region (v2)"]);
    expect((await lib.listSurfaces({ tags: ["retail"] })).surfaces).toHaveLength(1);
    expect((await lib.listSurfaceVersions({ id: "sales-by-region" })).versions.map((v) => [v.version, v.note])).toEqual([
      [2, "renamed"],
      [1, ""],
    ]);
    expect((await lib.getSurface({ id: "sales-by-region", version: 1 })).surface?.title).toBe("Sales by region");

    // A second library over the same storage sees what the first saved.
    const reopened = memorySurfaceLibrary({ storage });
    expect((await reopened.listSurfaces({})).surfaces).toHaveLength(2);
    await reopened.deleteSurface({ id: "orders-form" });
    expect((await memorySurfaceLibrary({ storage }).listSurfaces({})).surfaces).toHaveLength(1);
  });

  it("keeps only the newest versions and survives bad storage", async () => {
    const lib = memorySurfaceLibrary({ maxVersions: 2, storage: { load: () => "{not json", save: () => {} } });
    let v = 0;
    for (let i = 0; i < 4; i++) v = (await lib.saveSurface({ surface: { id: v ? "a" : "", title: "a", document: doc }, expectedVersion: v })).surface?.version ?? 0;
    expect((await lib.listSurfaceVersions({ id: "a" })).versions.map((x) => x.version)).toEqual([4, 3]);
  });
});
