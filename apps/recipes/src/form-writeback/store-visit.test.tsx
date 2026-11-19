// @vitest-environment jsdom
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createConnectTransport } from "@connectrpc/connect-node";
import { type SurfacesServer, createSurfacesServer, openSources, serverOptions } from "@surfaces-ui/dev-server";
import type { SurfaceAction } from "@surfaces-ui/spec";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { writebackConfig } from "./config.js";
import { StoreVisit } from "./StoreVisit.js";

let store: string;
let server: SurfacesServer;
let transport: ReturnType<typeof createConnectTransport>;

beforeAll(async () => {
  store = fs.mkdtempSync(path.join(os.tmpdir(), "surfaces-store-visit-"));
  const config = writebackConfig(store);
  server = await createSurfacesServer(await serverOptions(config, await openSources(config, store), store));
  const { url } = await server.listen(0);
  transport = createConnectTransport({ baseUrl: url, httpVersion: "1.1" });
}, 60_000);
afterAll(async () => {
  await server?.close();
  if (store) fs.rmSync(store, { recursive: true, force: true });
});
afterEach(cleanup);

describe("the store visit page in a browser", () => {
  it("checks the fields, sends only the form id and values, and reports the stored submission", async () => {
    const onAction = vi.fn<(action: SurfaceAction) => void>();
    render(<StoreVisit server={{ transport }} onAction={onAction} />);

    // Wrong values are caught before anything is sent.
    fireEvent.change(screen.getByLabelText(/^Rating/), { target: { value: "7" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save visit" })));
    expect(screen.getByText("Must be at most 5.")).toBeTruthy();
    expect(screen.getByText("Store is required.")).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
    expect(fs.readFileSync(path.join(store, "forms", "store-visit.jsonl"), "utf8")).toBe("");

    fireEvent.click(screen.getByLabelText("Hull"));
    fireEvent.change(screen.getByLabelText(/^Visited on/), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText(/^Rating/), { target: { value: "2" } });
    fireEvent.click(screen.getByLabelText("Needs a follow-up visit"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save visit" })));

    expect(await screen.findByText("Saved.")).toBeTruthy();
    const action = onAction.mock.calls[0]![0];
    expect(action).toMatchObject({ name: "visit_logged", context: { formId: "store-visit", values: { store: "Hull", visited_on: "2026-11-10", rating: 2, follow_up: true, note: null } } });
    const { submissions } = await server.forms!.listSubmissions({ formId: "store-visit" });
    expect(action.context.submissionId).toBe(submissions[0]!.id);
  });
});
