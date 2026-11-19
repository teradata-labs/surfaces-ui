// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ModelDiagram } from "../model/ModelDiagram.js";
import { type PipelineEdge, PipelineGraph, type PipelineNode } from "../pipeline/Pipeline.js";
import { IDENTITY, PAN_STEP, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampPan, clampZoom, fitView, revealBox, toWorld, wheelFactor, zoomAt } from "./usePanZoom.js";

afterEach(cleanup);

describe("pan and zoom maths", () => {
  it("clamps zoom to a sensible range", () => {
    expect(clampZoom(100)).toBe(ZOOM_MAX);
    expect(clampZoom(0.001)).toBe(ZOOM_MIN);
    expect(clampZoom(Number.NaN)).toBe(1);
    expect(clampZoom(3, { max: 4 })).toBe(3);
  });

  it("keeps the point under the pointer still while zooming", () => {
    const view = { x: 30, y: -20, k: 0.8 };
    const at = { x: 120, y: 90 };
    const before = toWorld(view, at);
    const after = zoomAt(view, 1.7, at);
    expect(after.k).toBeCloseTo(1.36);
    const moved = toWorld(after, at);
    expect(moved.x).toBeCloseTo(before.x);
    expect(moved.y).toBeCloseTo(before.y);
    // At the limit the view stays where it is.
    expect(zoomAt({ x: 5, y: 5, k: ZOOM_MAX }, 2, at)).toEqual({ x: 5, y: 5, k: ZOOM_MAX });
  });

  it("fits content centred and never larger than life", () => {
    const big = fitView({ width: 2000, height: 500 }, { width: 432, height: 300 });
    expect(big.k).toBeCloseTo(0.2);
    expect(big.x).toBeCloseTo((432 - 2000 * big.k) / 2);
    expect(big.y).toBeCloseTo((300 - 500 * big.k) / 2);
    const small = fitView({ width: 100, height: 50 }, { width: 400, height: 300 });
    expect(small).toEqual({ k: 1, x: 150, y: 125 });
    expect(fitView({ width: 0, height: 0 }, { width: 400, height: 300 })).toBe(IDENTITY);
    expect(fitView({ width: 100, height: 100 }, { width: 0, height: 0 })).toBe(IDENTITY);
  });

  it("never pans the content right out of view", () => {
    const content = { width: 1000, height: 1000 };
    const viewport = { width: 400, height: 300 };
    expect(clampPan({ x: 5000, y: -5000, k: 1 }, content, viewport)).toEqual({ x: 400 - 48, y: 48 - 1000, k: 1 });
    expect(clampPan({ x: -100, y: -100, k: 1 }, content, viewport)).toEqual({ x: -100, y: -100, k: 1 });
  });

  it("zooms the same amount in as out", () => {
    expect(wheelFactor(-50) * wheelFactor(50)).toBeCloseTo(1);
    expect(wheelFactor(-50)).toBeGreaterThan(1);
    expect(wheelFactor(3, 1)).toBeCloseTo(wheelFactor(48));
  });

  it("pans just enough to show a focused box", () => {
    const viewport = { width: 400, height: 300 };
    const view = { x: 0, y: 0, k: 1 };
    expect(revealBox(view, { left: 20, top: 20, width: 50, height: 50 }, viewport)).toBe(view);
    expect(revealBox(view, { left: 500, top: 20, width: 50, height: 50 }, viewport)).toEqual({ x: 400 - 16 - 550, y: 0, k: 1 });
    expect(revealBox(view, { left: -80, top: -40, width: 50, height: 50 }, viewport)).toEqual({ x: 96, y: 56, k: 1 });
  });
});

// jsdom has no layout: give every element a size so the viewport can be measured.
let restore: () => void;
beforeAll(() => {
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 400 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => 200 });
  restore = () => {
    if (width) Object.defineProperty(HTMLElement.prototype, "clientWidth", width);
    if (height) Object.defineProperty(HTMLElement.prototype, "clientHeight", height);
  };
});
afterAll(() => restore());

const nodes: PipelineNode[] = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, name: `step_${i}`, kind: "table" }));
const edges: PipelineEdge[] = nodes.slice(1).map((n, i) => ({ from: `n${i}`, to: n.id }));

const scaleOf = (plane: Element) => Number(/scale\(([^)]+)\)/.exec((plane as HTMLElement).style.transform)?.[1]);
const translateOf = (plane: Element) => (/translate\(([-\d.e]+)px, ([-\d.e]+)px\)/.exec((plane as HTMLElement).style.transform) ?? []).slice(1).map(Number);

describe("PipelineGraph pan and zoom", () => {
  const setup = () => {
    const onSelect = vi.fn();
    render(<PipelineGraph nodes={nodes} edges={edges} onSelect={onSelect} />);
    const canvas = screen.getByRole("group", { name: "Pipeline" });
    const plane = canvas.querySelector(".sf-pipeline-plane")!;
    const controls = within(screen.getByRole("group", { name: "Zoom the pipeline" }));
    return { onSelect, canvas, plane, controls };
  };

  it("fits the whole pipeline on first draw", () => {
    const { plane, controls } = setup();
    // Six columns of 200px nodes do not fit in 400px, so the view is zoomed out.
    expect(scaleOf(plane)).toBeLessThan(0.3);
    expect(controls.getByRole("status").textContent).toBe(`${Math.round(scaleOf(plane) * 100)}%`);
  });

  it("zooms, fits and resets from buttons that are labelled", () => {
    const { plane, controls } = setup();
    const fitted = scaleOf(plane);
    fireEvent.click(controls.getByRole("button", { name: "Zoom in" }));
    expect(scaleOf(plane)).toBeCloseTo(fitted * ZOOM_STEP);
    fireEvent.click(controls.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(controls.getByRole("button", { name: "Zoom out" }));
    expect(scaleOf(plane)).toBeCloseTo(Math.max(ZOOM_MIN, fitted / ZOOM_STEP));
    fireEvent.click(controls.getByRole("button", { name: "Reset zoom to 100%" }));
    expect(scaleOf(plane)).toBe(1);
    expect(controls.getByRole("status").textContent).toBe("100%");
    fireEvent.click(controls.getByRole("button", { name: "Fit to view" }));
    expect(scaleOf(plane)).toBeCloseTo(fitted);
    // The smooth move is a CSS transition, which reduced motion turns off.
    expect(plane.hasAttribute("data-animate")).toBe(true);
  });

  it("stops at the largest zoom and says so by disabling the button", () => {
    const { controls } = setup();
    const zoomIn = controls.getByRole("button", { name: "Zoom in" }) as HTMLButtonElement;
    for (let i = 0; i < 30 && !zoomIn.disabled; i++) fireEvent.click(zoomIn);
    expect(zoomIn.disabled).toBe(true);
    expect(controls.getByRole("status").textContent).toBe(`${ZOOM_MAX * 100}%`);
  });

  it("answers + - 0 and arrows when the canvas has focus, but not when a node does", () => {
    const { canvas, plane } = setup();
    const fitted = scaleOf(plane);
    fireEvent.keyDown(canvas, { key: "+" });
    expect(scaleOf(plane)).toBeCloseTo(fitted * ZOOM_STEP);
    fireEvent.keyDown(canvas, { key: "-" });
    expect(scaleOf(plane)).toBeCloseTo(fitted);
    fireEvent.keyDown(canvas, { key: "+" });
    fireEvent.keyDown(canvas, { key: "+" });
    const [x] = translateOf(plane);
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(translateOf(plane)[0]).toBeCloseTo(x! + PAN_STEP);
    fireEvent.keyDown(canvas, { key: "0" });
    expect(scaleOf(plane)).toBeCloseTo(fitted);
    // Arrow keys on a node still move between nodes; they do not zoom the view.
    fireEvent.keyDown(screen.getByRole("button", { name: /^step_0/ }), { key: "ArrowRight" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^step_1/ }));
    expect(scaleOf(plane)).toBeCloseTo(fitted);
  });

  it("zooms about the pointer with Ctrl + wheel, pans with a plain wheel, and pans by dragging the background", () => {
    const { canvas, plane } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    fireEvent.wheel(canvas, { deltaY: -100, ctrlKey: true, clientX: 100, clientY: 50 });
    const k = scaleOf(plane);
    expect(k).toBeGreaterThan(1);
    const [x, y] = translateOf(plane);
    // The plane point that was under (100, 50) is still there.
    expect((100 - x!) / k).toBeCloseTo(100);
    expect((50 - y!) / k).toBeCloseTo(50);

    fireEvent.wheel(canvas, { deltaX: 30, deltaY: 20 });
    expect(translateOf(plane)[0]).toBeCloseTo(x! - 30, 2);
    expect(translateOf(plane)[1]).toBeCloseTo(y! - 20, 2);

    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 200, clientY: 100, button: 0, pointerType: "mouse" });
    expect(canvas.hasAttribute("data-panning")).toBe(true);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 110 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 150, clientY: 110 });
    const [px, py] = translateOf(plane);
    expect(px).toBeCloseTo(x! - 30 - 50, 2);
    expect(py).toBeCloseTo(y! - 20 + 10, 2);
    expect(canvas.hasAttribute("data-panning")).toBe(false);
  });

  it("pinches with two pointers", () => {
    const { canvas, plane } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 100, clientY: 100, pointerType: "touch" });
    fireEvent.pointerDown(canvas, { pointerId: 2, clientX: 200, clientY: 100, pointerType: "touch" });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 250, clientY: 100, pointerType: "touch" });
    expect(scaleOf(plane)).toBeGreaterThan(1.3);
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 2 });
  });

  it("still selects nodes at any zoom", () => {
    const { onSelect, controls } = setup();
    fireEvent.click(controls.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: /^step_3/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "n3" }));
  });
});

describe("ModelDiagram pan and zoom", () => {
  const dataSource = memoryDataSource({
    sourceId: "shop",
    tables: {
      customers: [{ customer_id: 1, region_id: 1, name: "Ada" }],
      regions: [{ region_id: 1, label: "EU" }],
    },
  });

  it("joins by dragging a column, and moves cards by plane distance, when zoomed", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["customers", "regions"]} />);
    const target = (await screen.findByText("label")).closest("li")!.previousElementSibling as HTMLElement;
    const canvas = screen.getByRole("group", { name: "Data model" });
    const controls = within(screen.getByRole("group", { name: "Zoom the data model" }));
    fireEvent.click(controls.getByRole("button", { name: "Reset zoom to 100%" }));
    fireEvent.click(controls.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(controls.getByRole("button", { name: "Zoom out" }));
    const plane = canvas.querySelector(".sf-model-plane")!;
    expect(scaleOf(plane)).toBeCloseTo(1 / ZOOM_STEP ** 2);

    // Drawing a join is unchanged by zoom.
    const source = screen.getAllByText("region_id")[0]!.closest("li")!;
    document.elementFromPoint = () => target;
    fireEvent.pointerDown(source, { clientX: 10, clientY: 10, pointerId: 3 });
    fireEvent.pointerMove(canvas, { clientX: 300, clientY: 40, pointerId: 3 });
    fireEvent.pointerUp(canvas, { clientX: 300, clientY: 40, pointerId: 3 });
    expect(within(screen.getByRole("region", { name: "Joins" })).getByText("customers.region_id = regions.region_id")).toBeTruthy();

    // A card dragged 64 screen px moves 64 / k plane px, and the view does not pan with it.
    const card = screen.getByRole("region", { name: "Table customers" });
    const left = Number.parseFloat(card.style.left);
    const transform = (plane as HTMLElement).style.transform;
    const head = card.querySelector("header")!;
    fireEvent.pointerDown(head, { clientX: 100, clientY: 20, pointerId: 4, button: 0, pointerType: "mouse" });
    fireEvent.pointerMove(canvas, { clientX: 164, clientY: 20, pointerId: 4 });
    fireEvent.pointerUp(canvas, { clientX: 164, clientY: 20, pointerId: 4 });
    expect(Number.parseFloat(card.style.left)).toBeCloseTo(left + 64 * ZOOM_STEP ** 2);
    expect((plane as HTMLElement).style.transform).toBe(transform);
  });

  it("fits the diagram to view once the tables have loaded", async () => {
    render(<ModelDiagram dataSource={dataSource} sourceId="shop" tables={["customers", "regions"]} />);
    await screen.findByText("label");
    await act(async () => {});
    const plane = screen.getByRole("group", { name: "Data model" }).querySelector(".sf-model-plane")!;
    // Two 240px cards side by side do not fit in 400px.
    expect(scaleOf(plane)).toBeLessThan(1);
  });
});
