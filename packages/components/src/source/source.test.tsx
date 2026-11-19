// @vitest-environment jsdom
import { create } from "@bufbuild/protobuf";
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { ConnectionKind, Engine, ListSourcesResponseSchema, TestSourceResponseSchema } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ConnectionBuilder, type ConnectionDraft, connectionPlan, emptyConnectionDraft } from "./ConnectionBuilder.js";
import { SourceList } from "./SourceList.js";

afterEach(cleanup);

/** The text of every code block in `root`; highlighting splits code into many elements. */
const codeText = (root: ParentNode = document) => [...root.querySelectorAll("pre code")].map((c) => c.textContent).join("\n");


const lake: DataSource = {
  ...memoryDataSource({ tables: { orders: [{ a: 1 }] } }),
  listSources: async () =>
    create(ListSourcesResponseSchema, {
      sources: [
        {
          id: "lake",
          displayName: "Sales lake",
          engine: Engine.DUCKDB,
          readOnly: true,
          capabilities: { timeTravel: true },
          connections: [
            { name: "sales", kind: ConnectionKind.S3, scope: "s3://acme-lake/sales", credentialsSecret: "LAKE", region: "eu-west-1" },
            { name: "polaris", kind: ConnectionKind.ICEBERG_REST, scope: "https://catalog.example.com", ambientCredentials: true },
          ],
        },
      ],
    }),
  testSource: async () =>
    create(TestSourceResponseSchema, {
      ok: false,
      message: "1 of 2 could not be reached",
      engineVersion: "v2",
      checks: [
        { name: "orders", ok: true, message: "Reachable" },
        { name: "events", ok: false, message: "HTTP 403 Forbidden" },
      ],
    }),
};

describe("SourceList", () => {
  it("shows how each source connects, by secret name only, and tests each table", async () => {
    render(<SourceList dataSource={lake} />);
    expect(await screen.findByRole("heading", { name: "Sales lake" })).toBeTruthy();
    expect(screen.getByText("lake · DuckDB · Read only · Time travel")).toBeTruthy();
    const row = screen.getByRole("rowheader", { name: "sales" }).closest("tr")!;
    expect(within(row).getAllByRole("cell").map((c) => c.textContent)).toEqual(["Amazon S3", "s3://acme-lake/sales", "Secret LAKE"]);
    expect(screen.getByText("The server's own cloud credentials")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText(/1 of 2 could not be reached/)).toBeTruthy();
    expect(screen.getByText("HTTP 403 Forbidden")).toBeTruthy();
  });
});

describe("ConnectionBuilder", () => {
  const s3: ConnectionDraft = {
    ...emptyConnectionDraft,
    scope: "s3://acme-lake/sales/",
    region: "eu-west-1",
    tables: [
      { name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" },
      { name: "events", format: "iceberg", path: "s3://acme-lake/sales/events" },
    ],
    catalogUri: "https://catalog.example.com/api",
    catalogWarehouse: "analytics",
  };

  it("writes config with secret names and lists the variables that hold the values", () => {
    const plan = connectionPlan(s3);
    expect(plan.problems).toEqual([]);
    expect(plan.config).toBe(
      [
        "{",
        '  id: "lake",',
        '  engine: "duckdb",',
        '  connections: [{ name: "lake", kind: "s3", scope: "s3://acme-lake/sales", secret: "LAKE", region: "eu-west-1" }],',
        "  tables: [",
        '    { name: "orders", format: "delta", path: "s3://acme-lake/sales/orders" },',
        '    { name: "events", format: "iceberg", path: "s3://acme-lake/sales/events" },',
        "  ],",
        '  catalogs: [{ name: "catalog", kind: "iceberg-rest", uri: "https://catalog.example.com/api", warehouse: "analytics", secret: "LAKE" }],',
        "}",
      ].join("\n"),
    );
    expect(plan.env).toEqual(["LAKE_KEY_ID", "LAKE_SECRET", "LAKE_TOKEN"]);
    expect(connectionPlan({ ...s3, credentials: "ambient", catalogUri: "" })).toMatchObject({ env: [] });
    expect(connectionPlan({ ...s3, credentials: "ambient" }).config).toContain("ambientCredentials: true");
  });

  it("says what is wrong before offering any config", () => {
    const plan = connectionPlan({ ...s3, scope: "acme-lake", secret: "my key", tables: [{ name: "orders", format: "parquet", path: "s3://other/orders.parquet" }] });
    expect(plan.problems).toEqual([
      "The location should start with s3://",
      "Name the secret in capitals, e.g. LAKE. Its values are set on the server, not here.",
      "orders is outside acme-lake, so the connection will not cover it.",
    ]);
  });

  it("has no field for a credential and updates the plan as the form is filled in", () => {
    function Harness() {
      const [draft, setDraft] = useState<ConnectionDraft>({ ...emptyConnectionDraft, storage: "local" });
      return <ConnectionBuilder value={draft} onChange={setDraft} />;
    }
    render(<Harness />);
    expect(screen.queryByLabelText(/password|key|token/i)).toBeNull();
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "orders" } });
    fireEvent.change(screen.getByLabelText("Location"), { target: { value: "data/orders.parquet" } });
    expect(codeText()).toMatch(/path: "data\/orders.parquet"/);
    fireEvent.change(screen.getByLabelText("Storage"), { target: { value: "s3" } });
    expect(screen.getByLabelText("Secret name")).toBeTruthy();
    expect(screen.getByText("The location should start with s3://")).toBeTruthy();
  });
});
