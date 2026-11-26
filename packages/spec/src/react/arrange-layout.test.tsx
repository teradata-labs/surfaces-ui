// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { basicsCatalog } from "../basics.js";
import { type PageDocument, editPage, pageSurface } from "../page.js";
import { layoutEdits } from "../personal.js";
import type { SurfaceMessage } from "../surface.js";
import { ArrangeToggle, BESIDE_HOLD, receivingContainer, spaceLabel, useArrange } from "./arrange.js";
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

function Host({ steps, kindName, start = page, said = [] }: { steps: { title: string; messages: SurfaceMessage[] }[]; kindName?(kind: string): string; start?: PageDocument; said?: string[] }) {
  const [now, setNow] = useState(start);
  const surface = useMemo(() => pageSurface(now), [now]);
  const arrange = useArrange({
    surface,
    catalog: basicsCatalog,
    apply: (messages, title) => {
      steps.push({ title, messages });
      setNow((was) => editPage(was, layoutEdits(was, messages).edits, basicsCatalog).page);
    },
    say: (status) => void said.push(status.text),
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

describe("the order Tab goes in while arranging", () => {
  it("stops once on each component, at its controls, and on its size handles only once it is selected", () => {
    render(<Host steps={[]} />);
    arrangeOn();
    const widthOf = (id: string) => frame(id).querySelector<HTMLElement>(':scope > .sf-resize-handle[data-edge="right"]')!;
    expect(widthOf("one").tabIndex).toBe(-1);
    // Reaching its controls by keyboard selects it, and its handles come next.
    const control = frame("one").querySelector<HTMLElement>(':scope > .sf-arrange-bar [tabindex="0"]')!;
    act(() => control.focus());
    expect(frame("one").hasAttribute("data-selected")).toBe(true);
    expect(widthOf("one").tabIndex).toBe(0);
    expect(frame("two").querySelector<HTMLElement>(":scope > .sf-resize-handle")?.tabIndex ?? -1).toBe(-1);
  });
});

describe("dragging, as people found it", () => {
  /** Drags `from` by its bar to a pointer over `over`, whose box is given, and lets go. */
  const drag = (from: string, over: Element, box: { left: number; top: number; width: number; height: number }, at: { x: number; y: number }) => {
    const bar = frame(from).querySelector<HTMLElement>(".sf-arrange-bar")!;
    const original = document.elementFromPoint;
    document.elementFromPoint = () => over;
    try {
      (over.closest(".sf-arrange-frame") as HTMLElement).getBoundingClientRect = () => ({ ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON: () => ({}) });
      fireEvent.pointerDown(bar, { button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(window, { clientX: at.x, clientY: at.y });
      fireEvent.pointerUp(window, { clientX: at.x, clientY: at.y });
    } finally {
      document.elementFromPoint = original;
    }
  };

  it("puts focus back on the arrow pressed, so Enter twice moves twice", async () => {
    const start: PageDocument = { ...page, components: [...page.components.map((c) => (c.id === "stats" ? { ...c, children: ["one", "two", "three"] } : c)), { id: "three", component: "Text", text: "Three" }] };
    render(<Host steps={[]} start={start} />);
    arrangeOn();
    fireEvent.click(frame("one").querySelector<HTMLElement>('.sf-arrange-bar [data-control="later"]')!);
    await act(() => new Promise((done) => setTimeout(done, 20)));
    expect((document.activeElement as HTMLElement | null)?.dataset.control).toBe("later");
    fireEvent.click(document.activeElement as HTMLElement);
    expect(component("stats")?.children).toEqual(["two", "three", "one"]);
  });

  it("drops over the middle of a card into the list the card holds, and near its edge beside it", () => {
    const start: PageDocument = {
      ...page,
      components: [
        { id: "root", component: "Column", children: ["title", "panel"] },
        { id: "title", component: "Text", text: "Home", variant: "h1" },
        { id: "panel", component: "Card", child: "inner" },
        { id: "inner", component: "Column", children: ["note"] },
        { id: "note", component: "Text", text: "A note" },
      ],
    };
    render(<Host steps={[]} start={start} />);
    arrangeOn();
    drag("title", frame("panel").querySelector(".sf-arrange-name")!, { left: 0, top: 100, width: 400, height: 200 }, { x: 200, y: 200 });
    expect(component("inner")?.children).toEqual(["note", "title"]);
    expect(component("root")?.children).toEqual(["panel"]);
  });

  it("puts things side by side only once the pointer has rested at the edge", () => {
    vi.useFakeTimers();
    try {
      render(<Host steps={[]} />);
      arrangeOn();
      const bar = frame("title").querySelector<HTMLElement>(".sf-arrange-bar")!;
      const over = frame("panel").querySelector(".sf-arrange-name")!;
      (frame("panel") as HTMLElement).getBoundingClientRect = () => ({ left: 0, top: 100, width: 800, height: 100, right: 800, bottom: 200, x: 0, y: 100, toJSON: () => ({}) });
      const original = document.elementFromPoint;
      document.elementFromPoint = () => over;
      try {
        fireEvent.pointerDown(bar, { button: 0, clientX: 0, clientY: 0 });
        // Straight down along the left edge, as a bar held at its left end goes: above the panel, not beside it.
        fireEvent.pointerMove(window, { clientX: 10, clientY: 120 });
        expect(frame("panel").querySelector(":scope > .sf-arrange-insert")?.getAttribute("data-side")).toBe("before");
        // Resting there, it becomes beside.
        act(() => void vi.advanceTimersByTime(BESIDE_HOLD + 50));
        expect(frame("panel").querySelector(":scope > .sf-arrange-insert")?.getAttribute("data-side")).toBe("left");
        fireEvent.pointerUp(window, { clientX: 10, clientY: 120 });
      } finally {
        document.elementFromPoint = original;
      }
      expect(component("root")?.children).toEqual(["stats", "side-by-side"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("says a drop where something already is changes nothing", () => {
    const said: string[] = [];
    render(<Host steps={[]} said={said} />);
    arrangeOn();
    drag("one", frame("two").querySelector(".sf-arrange-name")!, { left: 200, top: 0, width: 200, height: 40 }, { x: 210, y: 10 });
    expect(said.at(-1)).toBe("It is already there.");
    expect(component("stats")?.children).toEqual(["one", "two"]);
  });

  it("offers no width handle in a row whose children are sized, which a drag would wipe", () => {
    const start: PageDocument = { ...page, components: page.components.map((c) => (c.id === "stats" ? { ...c, sizes: ["hug", "fill"] } : c)) };
    render(<Host steps={[]} start={start} />);
    arrangeOn();
    expect(frame("one").querySelector(':scope > .sf-resize-handle[data-edge="right"]')).toBeNull();
  });
});
