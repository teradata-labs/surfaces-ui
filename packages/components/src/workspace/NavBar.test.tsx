// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavBar } from "./NavBar.js";

const groups = [
  { label: "Build", items: [{ id: "play", label: "Playground" }, { id: "chat", label: "Chat" }] },
  { label: "Data", items: [{ id: "sql", label: "SQL workbench" }, { id: "model", label: "Data model" }] },
];

function narrowScreen(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: narrow, media: query, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("NavBar", () => {
  it("shows the sections, marks the current one, and lists its pages beneath", () => {
    narrowScreen(false);
    const onSelect = vi.fn();
    render(<NavBar label="Site" groups={groups} current="model" onSelect={onSelect} actions={<span>Status</span>} />);
    const global = screen.getByRole("navigation", { name: "Site" });
    expect(global.textContent).toContain("Build");
    expect(screen.getByRole("button", { name: "Data" }).getAttribute("aria-current")).toBe("true");
    const local = screen.getByRole("navigation", { name: "Data pages" });
    expect(local.textContent).toContain("SQL workbench");
    expect(screen.getByRole("button", { name: "Data model" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Status")).toBeTruthy();
    // A section goes to its first page.
    fireEvent.click(screen.getByRole("button", { name: "Build" }));
    expect(onSelect).toHaveBeenCalledWith("play");
  });

  it("folds into a menu on a narrow screen that holds focus and closes on Escape or a choice", () => {
    narrowScreen(true);
    const onSelect = vi.fn();
    render(<NavBar label="Site" groups={groups} current="play" onSelect={onSelect} actions={<span>Status</span>} />);
    expect(screen.queryByRole("button", { name: "Data" })).toBeNull();
    expect(screen.queryByText("Status")).toBeNull();
    const opener = screen.getByRole("button", { name: "Show Site navigation" });
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Site navigation" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close navigation" }));
    expect(dialog.textContent).toContain("Status");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "SQL workbench" }));
    expect(onSelect).toHaveBeenCalledWith("sql");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the menu when the page changes from inside it", () => {
    narrowScreen(true);
    const { rerender } = render(<NavBar label="Site" groups={groups} current="play" actions={<span>Status</span>} />);
    fireEvent.click(screen.getByRole("button", { name: "Show Site navigation" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    rerender(<NavBar label="Site" groups={groups} current="sql" actions={<span>Status</span>} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("writes links when items have addresses", () => {
    narrowScreen(false);
    render(<NavBar label="Site" groups={[{ label: "Docs", items: [{ id: "a", label: "Start", href: "#a" }] }]} current="a" />);
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("#a");
    expect(screen.getByRole("link", { name: "Start" }).getAttribute("aria-current")).toBe("page");
  });
});
