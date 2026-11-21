// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Callout, DeviceFrame, FeatureGrid, Footer, Hero, Media, PROMPT_REVEAL_TIMING, PostList, PromptReveal, Quote, Section, Showcase, postDate } from "./Site.js";

afterEach(cleanup);

function motion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
}

describe("Hero and Section", () => {
  it("give the page its headings in order, and name a section by its heading", () => {
    render(
      <>
        <Hero title="Surfaces UI" lead="Components for data work." actions={<button type="button">Start</button>} />
        <Section heading="Showcase" lead="Setups by role.">
          <p>Body</p>
        </Section>
      </>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Surfaces UI" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Showcase" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Showcase" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});

describe("FeatureGrid", () => {
  it("draws a link for an item with an address and a button that reports its id otherwise", () => {
    const onSelect = vi.fn();
    render(
      <FeatureGrid
        label="Roles"
        items={[
          { id: "analyst", title: "Analyst", line: "Ask and chart." },
          { id: "docs", title: "Docs", href: "https://example.com/docs" },
        ]}
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("list", { name: "Roles" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Docs" }).getAttribute("href")).toBe("https://example.com/docs");
    fireEvent.click(screen.getByRole("button", { name: /Analyst/ }));
    expect(onSelect).toHaveBeenCalledWith("analyst");
  });
});

describe("DeviceFrame", () => {
  it("draws the content once per device, each screen named and focusable", () => {
    render(<DeviceFrame title="Playground" label="a dashboard">{(device) => <p>on {device}</p>}</DeviceFrame>);
    expect(screen.getByRole("region", { name: "Desktop: a dashboard" }).getAttribute("tabindex")).toBe("0");
    expect(screen.getByRole("region", { name: "Phone: a dashboard" })).toBeTruthy();
    expect(screen.getByText("on desktop")).toBeTruthy();
    expect(screen.getByText("on phone")).toBeTruthy();
  });

  it("draws one device when asked", () => {
    const { container } = render(<DeviceFrame devices={["phone"]}>x</DeviceFrame>);
    expect(container.querySelectorAll("figure")).toHaveLength(1);
    expect(container.querySelector(".sf-site-devices-row")!.getAttribute("data-count")).toBe("1");
  });
});

describe("PromptReveal", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("types the prompt, then shows the answer, and starts again", () => {
    motion(false);
    render(
      <PromptReveal prompt="Hi">
        <p>Answer</p>
      </PromptReveal>,
    );
    // The answer keeps its place while the prompt types, hidden and out of reach, so the page does not jump.
    const answer = () => screen.getByText("Answer").parentElement!;
    expect(answer().hasAttribute("data-shown")).toBe(false);
    expect(answer().getAttribute("aria-hidden")).toBe("true");
    expect(answer().inert).toBe(true);
    // The whole prompt is there at once for assistive technology.
    expect(screen.getAllByText("Hi")[0]!.className).toBe("sf-visually-hidden");
    act(() => vi.advanceTimersByTime(PROMPT_REVEAL_TIMING.start + PROMPT_REVEAL_TIMING.type * 2));
    expect(answer().hasAttribute("data-shown")).toBe(true);
    expect(answer().inert).toBe(false);
    act(() => vi.advanceTimersByTime(PROMPT_REVEAL_TIMING.hold + 1));
    expect(answer().hasAttribute("data-shown")).toBe(false);
  });

  it("stops on the finished answer when paused or reached into, and plays again", () => {
    motion(false);
    render(
      <PromptReveal prompt="Hello there">
        <button type="button">Inside</button>
      </PromptReveal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Paused/);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(screen.queryByRole("button", { name: "Inside" })).toBeNull();
    expect(screen.getByRole("button", { name: "Inside", hidden: true })).toBeTruthy();
    act(() => vi.advanceTimersByTime(PROMPT_REVEAL_TIMING.start + PROMPT_REVEAL_TIMING.type * 20));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Inside" }));
    expect(screen.getByRole("button", { name: "Play" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the answer at once, with no controls, under reduced motion", () => {
    motion(true);
    render(
      <PromptReveal prompt="Hi">
        <p>Answer</p>
      </PromptReveal>,
    );
    expect(screen.getByText("Answer")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });
});

describe("Showcase", () => {
  it("shows the chosen example and reports the choice", () => {
    const onChange = vi.fn();
    render(
      <Showcase
        label="Who it is for"
        items={[
          { id: "a", name: "Analyst", content: <p>Charts</p> },
          { id: "b", name: "Steward", line: "Keeps data right.", content: <p>Checks</p> },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("Charts")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Steward" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByText("Checks")).toBeTruthy();
    expect(screen.getByText("Keeps data right.")).toBeTruthy();
  });
});

describe("Footer, Media, Quote, Callout and posts", () => {
  it("lists links in a named navigation", () => {
    const onSelect = vi.fn();
    render(<Footer groups={[{ label: "Docs", items: [{ id: "start", label: "Getting started" }, { id: "gh", label: "GitHub", href: "https://github.com" }] }]} note="Apache-2.0" onSelect={onSelect} />);
    expect(screen.getByRole("navigation", { name: "Site" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Getting started" }));
    expect(onSelect).toHaveBeenCalledWith("start");
    expect(screen.getByRole("link", { name: "GitHub" })).toBeTruthy();
  });

  it("holds an image's ratio, and shows its description where there is no address", () => {
    const { container, rerender } = render(<Media src="/a.png" alt="A chart" ratio="4:3" />);
    expect(screen.getByRole("img", { name: "A chart" }).getAttribute("loading")).toBe("lazy");
    expect((container.firstChild as HTMLElement).style.getPropertyValue("--sf-site-ratio")).toBe("4 / 3");
    rerender(<Media alt="A chart" />);
    expect(screen.getByRole("img", { name: "A chart" }).tagName).toBe("DIV");
  });

  it("names a callout by its kind, never by colour alone", () => {
    render(
      <>
        <Callout tone="warning">Back up first.</Callout>
        <Quote cite="A reader">It just works.</Quote>
      </>,
    );
    expect(screen.getByRole("complementary", { name: "Warning" }).textContent).toContain("Back up first.");
    expect(screen.getByText("A reader")).toBeTruthy();
  });

  it("lists posts with their dates in words, and says when there are none", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<PostList label="Essays" posts={[{ id: "one", title: "First", date: "2026-11-01", tags: ["design"] }]} onOpen={onOpen} />);
    expect(screen.getByText(postDate("2026-11-01")).getAttribute("datetime")).toBe("2026-11-01");
    fireEvent.click(screen.getByRole("button", { name: "First" }));
    expect(onOpen).toHaveBeenCalledWith("one");
    rerender(<PostList posts={[]} />);
    expect(screen.getByText("Nothing here yet.")).toBeTruthy();
    expect(postDate("not a date")).toBe("not a date");
  });
});
