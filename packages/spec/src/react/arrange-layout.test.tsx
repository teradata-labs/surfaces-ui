// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { basicsCatalog } from "../basics.js";
import { type PageDocument, editPage, pageSurface } from "../page.js";
import { layoutEdits } from "../personal.js";
import type { SurfaceMessage } from "../surface.js";
import { ArrangeToggle, receivingContainer, spaceLabel, useArrange } from "./arrange.js";
import { basicsRenderers } from "./renderers.js";
import { SurfaceView } from "./Surface.js";

afterEach(cleanup);

const page: PageDocument = {
  id: "home",
  title: "Home",
  catalogId: basicsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["title", "stats", "panel"] },
    { id: "title", component: "Text", text: "Home", variant: "h1" },
    { id: "stats", component: "Row", children: ["one", "two"] },
    { id: "one", component: "Text", text: "One" },
    { id: "two", component: "Text", text: "Two" },
    { id: "panel", component: "Card", child: "note" },
    { id: "note", component: "Text", text: "A note" },
  ],
};

function Host({ steps, kindName }: { steps: { title: string; messages: SurfaceMessage[] }[]; kindName?(kind: string): string }) {
  const [now, setNow] = useState(page);
  const surface = useMemo(() => pageSurface(now), [now]);
  const arrange = useArrange({
    surface,
    catalog: basicsCatalog,
    apply: (messages, title) => {
      steps.push({ title, messages });
      setNow((was) => editPage(was, layoutEdits(was, messages).edits, basicsCatalog).page);
    },
    say: () => undefined,
    remove: () => undefined,
    ...(kindName ? { kindName } : {}),
  });
  return (
    <>
      <ArrangeToggle arrange={arrange} />
      <div {...arrange.region}>
        <SurfaceView surface={arrange.shown(surface)} catalog={basicsCatalog} renderers={basicsRenderers} {...(arrange.surfaceFrame ? { frame: arrange.surfaceFrame } : {})} />
      </div>
      <output data-testid="page">{JSON.stringify(now.components)}</output>
    </>
  );
}

const component = (id: string) => (JSON.parse(screen.getByTestId("page").textContent ?? "[]") as Record<string, unknown>[]).find((c) => c.id === id);
const frame = (id: string) => document.querySelector<HTMLElement>(`[data-component="${id}"]`)!;
const arrangeOn = () => act(() => fireEvent.click(screen.getByRole("button", { name: "Arrange" })));

describe("gap and padding handles", () => {
  it("are shown only for the selected container", () => {
    render(<Host steps={[]} />);
    arrangeOn();
    expect(document.querySelector(".sf-arrange-space")).toBeNull();
    // A click on the row's frame selects it.
    act(() => fireEvent.click(frame("stats")));
    expect(frame("stats").hasAttribute("data-selected")).toBe(true);
    const names = [...document.querySelectorAll(".sf-arrange-space > [role=separator]")].map((s) => s.getAttribute("aria-label"));
    expect(names).toEqual([
      "Gap between the children of Row stats: drag, or use the arrow keys, to step through the spacing scale",
      "Padding of Row stats: drag, or use the arrow keys, to step through the spacing scale",
    ]);
    // The gap handle sits after the first child, across the row.
    expect(frame("one").querySelector(':scope > .sf-arrange-space[data-space="gap"] > [data-edge="right"]')).not.toBeNull();
    expect(frame("two").querySelector(".sf-arrange-space")).toBeNull();
  });

  it("selects a component when its bar is reached by keyboard", () => {
    render(<Host steps={[]} />);
    arrangeOn();
    act(() => frame("panel").querySelector<HTMLElement>(".sf-arrange-bar button")!.focus());
    expect(frame("panel").hasAttribute("data-selected")).toBe(true);
    // A Card has padding and no gap.
    expect([...document.querySelectorAll(".sf-arrange-space")].map((s) => s.getAttribute("data-space"))).toEqual(["padding"]);
  });

  it("step one token per arrow key, labelled with pixels and token, sent through apply", () => {
    const steps: { title: string; messages: SurfaceMessage[] }[] = [];
    render(<Host steps={steps} />);
    arrangeOn();
    act(() => fireEvent.click(frame("stats")));
    const gap = () => document.querySelector<HTMLElement>('.sf-arrange-space[data-space="gap"] > [role=separator]')!;
    expect(gap().getAttribute("aria-valuetext")).toBe("16 px · space-4");
    expect(document.querySelector('.sf-arrange-space[data-space="gap"] > .sf-arrange-space-label')!.textContent).toBe("16 px · space-4");
    fireEvent.keyDown(gap(), { key: "ArrowRight" });
    expect(component("stats")?.gap).toBe(6);
    expect(steps.at(-1)?.title).toBe('Set the gap of "stats" to 24 px · space-6');
    // The message is the one an agent would send: the Row whole, with its new gap.
    expect(steps.at(-1)?.messages[0]).toMatchObject({ updateComponents: { components: [{ id: "stats", component: "Row", children: ["one", "two"], gap: 6 }] } });
    fireEvent.keyDown(gap(), { key: "ArrowLeft" });
    fireEvent.keyDown(gap(), { key: "ArrowLeft" });
    expect(component("stats")?.gap).toBe(3);
    expect(gap().getAttribute("aria-valuetext")).toBe("12 px · space-3");
    // Home goes to none; Enter takes the prop off, back to the default.
    fireEvent.keyDown(gap(), { key: "Home" });
    expect(component("stats")?.gap).toBe("none");
    fireEvent.keyDown(gap(), { key: "Enter" });
    expect(component("stats")).not.toHaveProperty("gap");

    const padding = document.querySelector<HTMLElement>('.sf-arrange-space[data-space="padding"] > [role=separator]')!;
    expect(padding.getAttribute("aria-valuetext")).toBe("0 px · none");
    fireEvent.keyDown(padding, { key: "ArrowRight" });
    expect(component("stats")?.padding).toBe(1);
    expect(frame("stats").querySelector(".sf-a2-row")!.getAttribute("data-padding")).toBe("1");
  });

  it("snap from token to token as they are dragged, drawn before the release and sent once on it", () => {
    const steps: { title: string; messages: SurfaceMessage[] }[] = [];
    render(<Host steps={steps} />);
    arrangeOn();
    act(() => fireEvent.click(frame("stats")));
    const gap = document.querySelector<HTMLElement>('.sf-arrange-space[data-space="gap"] > [role=separator]')!;
    fireEvent.pointerDown(gap, { pointerType: "mouse", button: 0, clientX: 100, clientY: 0 });
    // A step is 8 px (space-2): 20 px on from space-4 (index 4 of the scale) is past its far end, space-8; 13 px back is two steps, space-2.
    fireEvent.pointerMove(window, { clientX: 100 + 20, clientY: 0 });
    expect(frame("stats").querySelector(".sf-a2-row")!.getAttribute("data-gap")).toBe("8");
    expect(steps).toHaveLength(0);
    fireEvent.pointerMove(window, { clientX: 100 - 13, clientY: 0 });
    expect(frame("stats").querySelector(".sf-a2-row")!.getAttribute("data-gap")).toBe("2");
    fireEvent.pointerUp(window, { clientX: 87, clientY: 0 });
    expect(steps).toHaveLength(1);
    expect(component("stats")?.gap).toBe(2);
  });

  it("say what a step is, with the theme's pixels where there is one", () => {
    expect(spaceLabel("none")).toBe("0 px · none");
    expect(spaceLabel(8)).toBe("32 px · space-8");
    const themed = document.createElement("div");
    themed.style.setProperty("--sf-space-4", "12px");
    document.body.append(themed);
    expect(spaceLabel(4, themed)).toBe("12 px · space-4");
    themed.remove();
  });
});

describe("drop feedback", () => {
  it("draws an insertion line in the gap and outlines the container that receives the drop", () => {
    render(<Host steps={[]} />);
    arrangeOn();
    const bar = frame("panel").querySelector<HTMLElement>(".sf-arrange-bar")!;
    const name = frame("one").querySelector<HTMLElement>(".sf-arrange-name")!;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => name;
    try {
      frame("one").getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 40, right: 200, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
      fireEvent.pointerDown(bar, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(window, { clientX: 150, clientY: 10 });
      // After "one", across the row: a line on its right, and the row outlined; no shadow on the frame itself.
      const line = frame("one").querySelector(":scope > .sf-arrange-insert")!;
      expect(line.getAttribute("data-side")).toBe("after");
      expect(line.hasAttribute("data-across")).toBe(true);
      expect(frame("stats").hasAttribute("data-receiving")).toBe(true);
      expect(frame("root").hasAttribute("data-receiving")).toBe(false);
      fireEvent.pointerUp(window, { clientX: 150, clientY: 10 });
    } finally {
      document.elementFromPoint = original;
    }
    expect(document.querySelector(".sf-arrange-insert, [data-receiving]")).toBeNull();
    expect(component("stats")?.children).toEqual(["one", "panel", "two"]);
  });

  it("names the receiving container for each kind of drop", () => {
    const surface = pageSurface(page);
    expect(receivingContainer(surface, { id: "stats", side: "inside" })).toBe("stats");
    expect(receivingContainer(surface, { id: "two", side: "before" })).toBe("stats");
    expect(receivingContainer(surface, { id: "panel", side: "left" })).toBe("root");
    expect(receivingContainer(surface, undefined)).toBeUndefined();
  });

  it("keeps keyboard arranging working", () => {
    const steps: { title: string; messages: SurfaceMessage[] }[] = [];
    render(<Host steps={steps} />);
    arrangeOn();
    fireEvent.click(frame("one").querySelector<HTMLElement>('.sf-arrange-bar [data-control="later"]')!);
    expect(component("stats")?.children).toEqual(["two", "one"]);
    expect(steps.at(-1)?.title).toBe('Moved "one" later');
  });
});

describe("names", () => {
  it("are the host's words for a kind on the bar and in the labels, and the catalog's otherwise", () => {
    const { unmount } = render(<Host steps={[]} kindName={(kind) => (kind === "Row" ? "Stack across" : kind)} />);
    arrangeOn();
    const bar = frame("stats").querySelector(".sf-arrange-name")!;
    expect(bar.textContent).toBe("Stack across stats");
    expect(frame("stats").querySelector("[aria-label=\"Stack across stats controls\"]")).toBeTruthy();
    expect(frame("title").querySelector(".sf-arrange-name")!.textContent).toBe("Text title");
    unmount();
    render(<Host steps={[]} />);
    arrangeOn();
    expect(frame("stats").querySelector(".sf-arrange-name")!.textContent).toBe("Row stats");
  });
});
