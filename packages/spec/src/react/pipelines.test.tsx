// @vitest-environment jsdom
import { PipelinesProvider } from "@surfaces-ui/components";
import { memoryPipelines } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyticsCatalog } from "../analytics.js";
import { type PageDocument, pageSurface, validatePage } from "../page.js";
import { patterns } from "../patterns.js";
import { SurfaceView, analyticsRenderers } from "./index.js";

afterEach(cleanup);

const page = (components: PageDocument["components"]): PageDocument => ({ id: "p", title: "P", catalogId: analyticsCatalog.id, components: [{ id: "root", component: "Column", children: components.map((c) => c.id) }, ...components] });

function draw(doc: PageDocument, pipelines = memoryPipelines([{ summary: { id: "sales", name: "Sales", sourceId: "lake" }, version: 1, datasets: [{ name: "orders_clean", sql: "SELECT * FROM orders WHERE status IS NOT NULL" }] }])) {
  expect(validatePage(doc, analyticsCatalog)).toEqual([]);
  const onAction = vi.fn();
  const onProblem = vi.fn();
  const onContext = vi.fn();
  render(
    <PipelinesProvider pipelines={pipelines}>
      <SurfaceView surface={pageSurface(doc)} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={onAction} onProblem={onProblem} onContext={onContext} />
    </PipelinesProvider>,
  );
  return { pipelines, onAction, onProblem, onContext };
}

describe("pipelines in a surface", () => {
  it("draws the catalog's DatasetReview example and saves it only on approval, with an event the catalog declares", async () => {
    const example = analyticsCatalog.components.DatasetReview!.example as PageDocument["components"][number];
    const { pipelines, onAction, onProblem } = draw(page([example]));
    expect(await screen.findByText("Add region_revenue in Sales")).toBeTruthy();
    expect(screen.getByText("region is found in orders_clean.region")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Approved by"), { target: { value: "Ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve and save" }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
    expect(onAction.mock.calls[0]![0]).toMatchObject({ name: "dataset_decided", context: { approved: true, version: 2, approvedBy: "Ada" } });
    expect(onProblem).not.toHaveBeenCalled();
    expect((await pipelines.getPipeline({ id: "sales" })).pipeline!.datasets.map((d) => d.name)).toEqual(["orders_clean", "region_revenue"]);
  });

  it("draws the review-a-transformation pattern", async () => {
    const pattern = patterns.find((p) => p.id === "review-a-transformation")!;
    draw({ id: "p", title: "P", catalogId: analyticsCatalog.id, components: pattern.components as PageDocument["components"] });
    expect(await screen.findByText("Add daily_revenue in Sales")).toBeTruthy();
    expect(screen.getByText("at least 1 rows")).toBeTruthy();
  });

  it("says so when the proposal is not a pipeline", async () => {
    draw(page([{ id: "r", component: "DatasetReview", pipeline: { id: "x", datasets: "nope" }, dataset: "a", expectedVersion: 0 }]));
    expect((await screen.findByRole("note")).textContent).toMatch(/could not be read/);
  });

  it("sends a PipelineView run's start and end as declared events", async () => {
    const { onAction, onProblem, onContext } = draw(page([{ id: "view", component: "PipelineView", pipelineId: "sales", action: { event: { name: "pipeline_run" } } }]));
    fireEvent.click(await screen.findByRole("button", { name: "Run" }));
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(2));
    expect(onAction.mock.calls.map((c) => c[0].context.event)).toEqual(["started", "finished"]);
    expect(onAction.mock.calls[1]![0].context).toMatchObject({ state: "completed", built: 1, failed: [], failedChecks: [] });
    expect(onProblem).not.toHaveBeenCalled();
    expect(onContext.mock.calls.map((c) => c[1].kind)).toEqual(["run.started", "run.finished"]);
  });
});
