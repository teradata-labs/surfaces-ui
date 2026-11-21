// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SideNav, navigationName } from "./SideNav.js";
import { Workspace } from "./Workspace.js";

afterEach(cleanup);

const panels = [
  { id: "search", title: "Table search", content: <p>search body</p> },
  { id: "map", title: "Relationship map", content: <p>map body</p> },
  { id: "notes", title: "Notes", content: <p>notes body</p> },
];
const columnsOf = (container: HTMLElement) => [...container.querySelectorAll(".sf-workspace-column")].map((column) => [...column.querySelectorAll(".sf-workspace-panel-title")].map((t) => t.textContent));

describe("Workspace", () => {
  it("draws panels where the layout puts them and leaves hidden ones to the rail", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels} defaultLayout={{ columns: [["search"], ["map"]], hidden: ["notes"] }} />);
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map"]]);
    expect(screen.queryByText("notes body")).toBeNull();
    const rail = screen.getByRole("toolbar", { name: "Catalog: show or hide panels" });
    expect(within(rail).getByRole("button", { name: "Notes" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(rail).getByRole("button", { name: "Table search" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows and hides a panel from the rail, and reports the layout", () => {
    const onLayoutChange = vi.fn();
    const { container } = render(<Workspace label="Catalog" panels={panels} defaultLayout={{ columns: [["search"], ["map"]], hidden: ["notes"] }} onLayoutChange={onLayoutChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map", "Notes"]]);
    expect(onLayoutChange).toHaveBeenLastCalledWith(expect.objectContaining({ columns: [["search"], ["map", "notes"]], hidden: [] }));
    fireEvent.click(screen.getByRole("button", { name: "Table search" }));
    expect(columnsOf(container)).toEqual([["Relationship map", "Notes"]]);
    expect(screen.getByRole("status").textContent).toBe("Table search is hidden.");
  });

  it("moves a panel without a pointer, from the menu in its heading, and says where it went", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["map", "search"]] }} />);
    const choose = (panel: string, item: string) => {
      fireEvent.click(screen.getByRole("button", { name: `Move ${panel}` }));
      fireEvent.click(within(screen.getByRole("menu", { name: `Move ${panel}` })).getByRole("menuitem", { name: item }));
    };
    choose("Table search", "Move left");
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map"]]);
    expect(screen.getByRole("status").textContent).toBe("Table search is now in column 1 of 2, place 1.");
    expect(screen.queryByRole("menu")).toBeNull();
    // A way that would change nothing is offered greyed out, so the menu keeps its shape.
    fireEvent.click(screen.getByRole("button", { name: "Move Table search" }));
    const menu = screen.getByRole("menu", { name: "Move Table search" });
    expect((within(menu).getByRole("menuitem", { name: "Move left" }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(menu).getByRole("menuitem", { name: "Move right" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.keyDown(menu, { key: "Escape" });
    choose("Relationship map", "Hide");
    expect(columnsOf(container)).toEqual([["Table search"]]);
  });

  it("opens the same menu on a right click of a panel's heading", () => {
    render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["search"], ["map"]] }} />);
    fireEvent.contextMenu(screen.getByRole("heading", { name: "Relationship map" }).closest("header")!);
    expect(within(screen.getByRole("menu", { name: "Move Relationship map" })).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Move left", "Move right", "Move up", "Move down", "To a new column on the left", "To a new column on the right", "Hide"]);
  });

  it("resizes columns with the arrow keys on the divider between them", () => {
    const onLayoutChange = vi.fn();
    render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["search"], ["map"]] }} onLayoutChange={onLayoutChange} />);
    const divider = screen.getByRole("separator", { name: "Resize column 1 and column 2" });
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(onLayoutChange.mock.lastCall![0].columnWidths[0]).toBeCloseTo(0.54);
    expect(screen.getByRole("separator", { name: "Resize column 1 and column 2" }).getAttribute("aria-valuenow")).toBe("54");
  });

  it("drags a panel by its heading with a pointer (a mouse, a pen or a finger) into a new column at the edge", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["map", "search"]] }} />);
    const head = screen.getByRole("heading", { name: "Table search" }).closest("header")!;
    // jsdom has no layout: say what is under the pointer.
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100 });
    // A small movement is still a press, not a drag.
    fireEvent.pointerMove(window, { clientX: 102, clientY: 101 });
    expect(container.querySelectorAll(".sf-workspace-drop-column").length).toBe(0);
    fireEvent.pointerMove(window, { clientX: 60, clientY: 140 });
    const zones = container.querySelectorAll(".sf-workspace-drop-column");
    expect(zones.length).toBe(2);
    expect(container.querySelector(".sf-workspace-ghost")!.textContent).toBe("Table search");
    under = zones[0]!;
    fireEvent.pointerMove(window, { clientX: 10, clientY: 140 });
    expect(zones[0]!.hasAttribute("data-over")).toBe(true);
    fireEvent.pointerUp(window, { clientX: 10, clientY: 140 });
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map"]]);
    expect(container.querySelectorAll(".sf-workspace-drop-column").length).toBe(0);
    expect(container.querySelector(".sf-workspace-ghost")).toBeNull();
  });

  it("gives up a drag on Escape, or when it ends over nothing", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["map", "search"]] }} />);
    const head = screen.getByRole("heading", { name: "Table search" }).closest("header")!;
    let under: Element | null = null;
    document.elementFromPoint = () => under;
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 140 });
    under = container.querySelector(".sf-workspace-drop-column");
    fireEvent.pointerMove(window, { clientX: 10, clientY: 140 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(columnsOf(container)).toEqual([["Relationship map", "Table search"]]);
    expect(container.querySelectorAll(".sf-workspace-drop-column").length).toBe(0);
    // Released over no zone.
    under = null;
    fireEvent.pointerDown(head, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 140 });
    fireEvent.pointerUp(window, { clientX: 40, clientY: 140 });
    expect(columnsOf(container)).toEqual([["Relationship map", "Table search"]]);
  });

  it("does not start a drag from a button in the heading", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["map", "search"]] }} />);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move Table search" }), { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 180 });
    expect(container.querySelectorAll(".sf-workspace-drop-column").length).toBe(0);
  });

  it("names each rail button in full, shows an icon, and falls back to the first letter", () => {
    const named = [
      { id: "data", title: "Data model and controls", shortTitle: "Data", icon: "data" as const, content: <p>d</p> },
      { id: "notes", title: "Notes", content: <p>n</p> },
    ];
    const { container } = render(<Workspace label="Catalog" panels={named} />);
    // Icons only to begin with: the buttons still carry their full names.
    const button = screen.getByRole("button", { name: "Data model and controls" });
    expect(button.querySelector(".sf-workspace-rail-label")).toBeNull();
    expect(button.querySelector("svg.sf-workspace-icon")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Notes" }).querySelector(".sf-workspace-icon-letter")!.textContent).toBe("N");
    // The name shows at once on hover and on focus, in the workspace's own tooltip, not the browser's delayed one.
    expect(button.hasAttribute("title")).toBe(false);
    expect(container.querySelector(".sf-workspace-tip")).toBeNull();
    fireEvent.pointerEnter(button);
    expect(container.querySelector(".sf-workspace-tip")!.textContent).toBe("Hide Data model and controls");
    fireEvent.pointerLeave(button);
    expect(container.querySelector(".sf-workspace-tip")).toBeNull();
    fireEvent.focus(button);
    expect(container.querySelector(".sf-workspace-tip")!.textContent).toBe("Hide Data model and controls");
    fireEvent.keyDown(button, { key: "Escape" });
    expect(container.querySelector(".sf-workspace-tip")).toBeNull();
    // A person turns names on from the rail's foot.
    const size = screen.getByRole("button", { name: "Show panel names on the rail" });
    expect(size.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(size);
    expect(screen.getByRole("button", { name: "Data model and controls" }).querySelector(".sf-workspace-rail-label")!.textContent).toBe("Data");
    expect(container.querySelector(".sf-workspace-rail")!.hasAttribute("data-labels")).toBe(true);
    expect(screen.getByRole("button", { name: "Show panel names on the rail" }).getAttribute("aria-pressed")).toBe("true");
    // A host can hold the choice and hear about it.
    cleanup();
    const onRailLabelsChange = vi.fn();
    render(<Workspace label="Catalog" panels={named} railLabels={false} onRailLabelsChange={onRailLabelsChange} />);
    expect(screen.getByRole("button", { name: "Data model and controls" }).querySelector(".sf-workspace-rail-label")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show panel names on the rail" }));
    expect(onRailLabelsChange).toHaveBeenCalledWith(true);
  });

  it("keeps the rail of a workspace inside another to icons, with no names to turn on", () => {
    const inner = <Workspace label="Inner" panels={[{ id: "x", title: "Inner one", content: <p>x</p> }, { id: "y", title: "Inner two", content: <p>y</p> }]} railLabels />;
    render(<Workspace label="Outer" panels={[{ id: "host", title: "Host", content: inner }, { id: "side", title: "Side", content: <p>s</p> }]} railLabels />);
    const outer = screen.getByRole("toolbar", { name: "Outer: show or hide panels" });
    const nested = screen.getByRole("toolbar", { name: "Inner: show or hide panels" });
    expect(outer.hasAttribute("data-labels")).toBe(true);
    expect(nested.hasAttribute("data-labels")).toBe(false);
    expect(within(nested).queryByRole("button", { name: "Show panel names on the rail" })).toBeNull();
    expect(within(nested).getByRole("button", { name: "Inner one" })).toBeTruthy();
  });

  it("says why the last panel showing cannot be hidden, and does not hide it", () => {
    const { container } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["search"]], hidden: ["map"] }} />);
    const only = screen.getByRole("button", { name: "Table search" });
    expect(only.getAttribute("aria-disabled")).toBe("true");
    fireEvent.focus(only);
    expect(container.querySelector(".sf-workspace-tip")!.textContent).toBe("Table search: the only panel showing");
    fireEvent.click(only);
    expect(columnsOf(container)).toEqual([["Table search"]]);
  });

  it("folds a panel to its heading and opens it again, keeping what is inside", () => {
    const typed = [
      { id: "a", title: "First", content: <input aria-label="note" defaultValue="" /> },
      { id: "b", title: "Second", content: <p>second body</p> },
    ];
    const { container } = render(<Workspace label="Catalog" panels={typed} defaultLayout={{ columns: [["a", "b"]] }} />);
    fireEvent.change(screen.getByLabelText("note"), { target: { value: "kept" } });
    fireEvent.click(screen.getByRole("button", { name: "Fold First to its heading" }));
    expect(container.querySelector(".sf-workspace-panel[data-folded] .sf-workspace-panel-body")!.hasAttribute("hidden")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("First is folded.");
    // The only open panel of the column cannot be folded too.
    fireEvent.click(screen.getByRole("button", { name: "Fold Second to its heading" }));
    expect(container.querySelectorAll(".sf-workspace-panel[data-folded]").length).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Open First" }));
    expect(container.querySelectorAll(".sf-workspace-panel[data-folded]").length).toBe(0);
    expect((container.querySelector('input[aria-label="note"]') as HTMLInputElement).value).toBe("kept");
  });

  it("offers no fold button to a panel alone in its column", () => {
    render(<Workspace label="Catalog" panels={panels.slice(0, 2)} defaultLayout={{ columns: [["search"], ["map"]] }} />);
    expect(screen.queryByRole("button", { name: /Fold / })).toBeNull();
  });

  it("follows a layout held by its host, as when an agent sets it", () => {
    const { container, rerender } = render(<Workspace label="Catalog" panels={panels.slice(0, 2)} layout={{ columns: [["map"], ["search"]] }} />);
    expect(columnsOf(container)).toEqual([["Relationship map"], ["Table search"]]);
    rerender(<Workspace label="Catalog" panels={panels.slice(0, 2)} layout={{ columns: [["search"], ["map"]] }} />);
    expect(columnsOf(container)).toEqual([["Table search"], ["Relationship map"]]);
  });
});

describe("SideNav", () => {
  const groups = [{ label: "Build", items: [{ id: "playground", label: "Playground", href: "#playground" }, { id: "chat", label: "Chat" }] }];

  it("marks the current item and reports a choice, for links and buttons alike", () => {
    const onSelect = vi.fn();
    render(<SideNav label="Site" groups={groups} current="playground" onSelect={onSelect} />);
    const nav = screen.getByRole("navigation", { name: "Site" });
    expect(within(nav).getByRole("link", { name: "Playground" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(within(nav).getByRole("button", { name: "Chat" }));
    expect(onSelect).toHaveBeenCalledWith("chat");
  });

  it("names its button and dialog without saying navigation twice", () => {
    expect(navigationName("Site")).toBe("Site navigation");
    expect(navigationName("Main navigation")).toBe("Main navigation");
    render(<SideNav label="Main navigation" groups={groups} defaultPinned={false} />);
    expect(screen.getByRole("button", { name: "Show Main navigation" })).toBeTruthy();
  });

  it("folds away to a menu button that opens it over the whole screen as a dialog, closed by Escape", () => {
    const onPinnedChange = vi.fn();
    const { container } = render(<SideNav label="Site" groups={groups} onPinnedChange={onPinnedChange} />);
    const root = container.querySelector(".sf-sidenav")!;
    expect(root.getAttribute("data-pinned")).toBe("true");
    expect(screen.queryByRole("button", { name: "Show Site navigation" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Fold away/ }));
    expect(onPinnedChange).toHaveBeenCalledWith(false);
    expect(root.getAttribute("data-pinned")).toBe("false");
    const menu = screen.getByRole("button", { name: "Show Site navigation" });
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(menu);
    expect(root.hasAttribute("data-open")).toBe(true);
    expect(menu.getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    // Focus goes in, to its close button.
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close Site navigation" }));
    fireEvent.keyDown(root, { key: "Escape" });
    expect(root.hasAttribute("data-open")).toBe(false);
    fireEvent.click(menu);
    fireEvent.click(within(dialog).getByRole("button", { name: /Keep open/ }));
    expect(onPinnedChange).toHaveBeenLastCalledWith(true);
  });

  it("is always folded on a narrow screen, with no pin to dock it", () => {
    const real = window.matchMedia;
    window.matchMedia = ((query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
    try {
      const { container } = render(<SideNav label="Site" groups={groups} pinned />);
      expect(container.querySelector(".sf-sidenav")!.getAttribute("data-pinned")).toBe("false");
      fireEvent.click(screen.getByRole("button", { name: "Show Site navigation" }));
      const dialog = screen.getByRole("dialog", { name: "Site navigation" });
      expect(within(dialog).queryByRole("button", { name: /Keep open|Fold away/ })).toBeNull();
      expect(within(dialog).getByRole("button", { name: "Close Site navigation" })).toBeTruthy();
    } finally {
      window.matchMedia = real;
    }
  });

  it("closes the takeover when a page is chosen, and keeps Tab inside while it is open", () => {
    const onSelect = vi.fn();
    render(<SideNav label="Site" groups={groups} defaultPinned={false} onSelect={onSelect} />);
    const menu = screen.getByRole("button", { name: "Show Site navigation" });
    fireEvent.click(menu);
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });
    const chat = within(dialog).getByRole("button", { name: "Chat" });
    chat.focus();
    // Chat is the last control: Tab goes round to the first, inside.
    fireEvent.keyDown(chat, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(chat);
    fireEvent.click(chat);
    expect(onSelect).toHaveBeenCalledWith("chat");
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    // A press on the dimmed page beside the drawer closes it too.
    fireEvent.click(menu);
    fireEvent.click(document.querySelector(".sf-sidenav-backdrop")!);
    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".sf-sidenav-backdrop")).toBeNull();
  });
});
