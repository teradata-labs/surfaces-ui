// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Markdown, parseMarkdown } from "./Markdown.js";

afterEach(cleanup);

describe("Markdown", () => {
  it("renders blocks and inline marks as elements", () => {
    render(<Markdown text={"# Sales\n\nRevenue is **up** in `EU`, see [the report](https://example.com/r).\n\n- one\n- two\n\n| Region | Total |\n|---|---|\n| EU | 10 |"} />);
    expect(screen.getByRole("heading", { level: 3, name: "Sales" })).toBeTruthy();
    expect(screen.getByText("up").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "the report" }).getAttribute("href")).toBe("https://example.com/r");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("columnheader", { name: "Total" })).toBeTruthy();
  });

  it("never turns text into markup or unsafe links", () => {
    const { container } = render(<Markdown text={'<img src=x onerror="alert(1)"> [bad](javascript:alert(1))'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("<img src=x");
  });

  it("shows code blocks, including one still streaming, and runs SQL only when asked", () => {
    const onRunSql = vi.fn();
    render(<Markdown text={"Try this:\n\n```sql\nSELECT 1\n```\n\n```python\nprint("} onRunSql={onRunSql} />);
    expect(parseMarkdown("```sql\nSELECT")).toEqual([{ kind: "code", language: "sql", code: "SELECT" }]);
    expect(screen.getAllByRole("button", { name: "Run" })).toHaveLength(1);
    expect(onRunSql).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(onRunSql).toHaveBeenCalledWith("SELECT 1");
  });

  it("draws an image only when the host gives its address, and shows its description otherwise", () => {
    const { rerender } = render(<Markdown text="See ![A chart of revenue](images/chart.png) here" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/A chart of revenue/)).toBeTruthy();
    rerender(<Markdown text="See ![A chart of revenue](images/chart.png) here" resolveImage={(src) => `https://docs.example.com/${src}`} />);
    expect(screen.getByRole("img", { name: "A chart of revenue" }).getAttribute("src")).toBe("https://docs.example.com/images/chart.png");
    rerender(<Markdown text="![x](javascript:alert(1))" resolveImage={(src) => src} />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("lets the host keep a link in the app, and opens it in a new tab otherwise", () => {
    const openLink = vi.fn((href: string) => href.startsWith("https://app.example.com/"));
    render(<Markdown text="[Guide](guide.md) and [Elsewhere](https://other.example.com/)" resolveLink={(href) => `https://app.example.com/#docs/${href}`} openLink={openLink} />);
    const guide = screen.getByRole("link", { name: "Guide" });
    expect(fireEvent.click(guide)).toBe(false);
    expect(openLink).toHaveBeenCalledWith("https://app.example.com/#docs/guide.md");
    expect(fireEvent.click(screen.getByRole("link", { name: "Elsewhere" }))).toBe(true);
    expect(fireEvent.click(guide, { metaKey: true })).toBe(true);
  });

  it("keeps a numbered list's own numbers when a code block splits it", () => {
    const { container } = render(<Markdown text={"1. Install\n\n```bash\npnpm i\n```\n\n2. Start"} />);
    const lists = container.querySelectorAll("ol");
    expect(lists).toHaveLength(2);
    expect(lists[0]!.getAttribute("start")).toBeNull();
    expect(lists[1]!.getAttribute("start")).toBe("2");
  });

  it("lets a keyboard reach a table, which may scroll sideways", () => {
    render(<Markdown text={"| Key | Does |\n|---|---|\n| Enter | Runs |"} />);
    const region = screen.getByRole("region", { name: "Table: Key, Does" });
    expect(region.tabIndex).toBe(0);
  });
});
