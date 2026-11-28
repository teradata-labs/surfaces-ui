// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Image, ImageResolverProvider, resolveImageAddress, safeImageAddress } from "./Image.js";
import { Markdown } from "./Markdown.js";

afterEach(cleanup);

describe("safeImageAddress", () => {
  it("accepts what a host can make and refuses what can run or leak", () => {
    for (const ok of ["https://img.example.com/a.png", "http://img.example.com/a.png", "blob:https://app.example.com/1b2c", "/files/a.png", "data:image/png;base64,AAAA", "data:image/webp;base64,AAAA"]) {
      expect(safeImageAddress(ok), ok).toBe(ok);
    }
    for (const no of ["javascript:alert(1)", "//evil.example.com/a.png", "/\\evil.example.com/a.png", "file:///etc/passwd", "data:text/html;base64,AAAA", "data:image/svg+xml;base64,AAAA", "images/a.png", "", undefined]) {
      expect(safeImageAddress(no), String(no)).toBeUndefined();
    }
  });

  it("asks a resolver only, and survives one that throws", () => {
    expect(resolveImageAddress(undefined, "x")).toBeUndefined();
    expect(resolveImageAddress(() => "https://a.example.com/x.png", "")).toBeUndefined();
    expect(resolveImageAddress(() => "https://a.example.com/x.png", "x")).toBe("https://a.example.com/x.png");
    expect(
      resolveImageAddress(() => {
        throw new Error("no");
      }, "x"),
    ).toBeUndefined();
  });
});

describe("Image", () => {
  it("never loads the address it was given: without a resolver the alt text stands in", () => {
    const { container } = render(<Image src="https://tracker.example.com/pixel.png" alt="A chart of revenue" caption="Revenue" />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByRole("img", { name: "A chart of revenue" }).textContent).toBe("A chart of revenue");
    expect(screen.getByText("Revenue").tagName).toBe("FIGCAPTION");
  });

  it("draws what the host's resolver returns, from a prop or from the provider", () => {
    const resolve = vi.fn((src: string) => (src === "attachment-1" ? "blob:https://app.example.com/abc" : undefined));
    const { container, rerender } = render(<Image src="attachment-1" alt="Revenue by month" resolveImage={resolve} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:https://app.example.com/abc");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Revenue by month");
    expect(resolve).toHaveBeenCalledWith("attachment-1");
    rerender(
      <ImageResolverProvider resolve={resolve}>
        <Image src="attachment-1" alt="From context" />
        <Image src="unknown" alt="Not known" />
      </ImageResolverProvider>,
    );
    expect(screen.getByRole("img", { name: "From context" }).tagName).toBe("IMG");
    // A name the host does not know shows its description.
    expect(screen.getByRole("img", { name: "Not known" }).tagName).toBe("DIV");
  });

  it("does not draw an address the resolver returns that could run or leak", () => {
    const { container } = render(<Image src="x" alt="Bad" resolveImage={() => "javascript:alert(1)"} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps decoration out of the accessibility tree and sizes from the props, as custom properties", () => {
    const { container } = render(<Image src="x" alt="" width={320} height={200} fit="cover" maxHeight={240} resolveImage={() => "https://a.example.com/x.png"} />);
    const figure = container.querySelector<HTMLElement>("figure")!;
    expect(figure.dataset.fit).toBe("cover");
    expect(figure.style.getPropertyValue("--sf-image-width")).toBe("320px");
    expect(figure.style.getPropertyValue("--sf-image-height")).toBe("200px");
    expect(figure.style.getPropertyValue("--sf-image-max-height")).toBe("240px");
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
  });
});

describe("Markdown with a resolver above it", () => {
  it("uses the provided resolver, unless given its own", () => {
    const text = "![A chart](chart-1)";
    const { container, rerender } = render(<Markdown text={text} />);
    expect(container.querySelector("img")).toBeNull();
    rerender(
      <ImageResolverProvider resolve={(src) => `https://img.example.com/${src}.png`}>
        <Markdown text={text} />
      </ImageResolverProvider>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://img.example.com/chart-1.png");
    rerender(
      <ImageResolverProvider resolve={(src) => `https://img.example.com/${src}.png`}>
        <Markdown text={text} resolveImage={() => "https://other.example.com/own.png"} />
      </ImageResolverProvider>,
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://other.example.com/own.png");
  });

  it("draws a blob or same-origin address a host made, still refusing scripts", () => {
    const { container, rerender } = render(<Markdown text="![a](1)" resolveImage={() => "blob:https://app.example.com/1"} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:https://app.example.com/1");
    rerender(<Markdown text="![a](1)" resolveImage={() => "/api/images/1"} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/api/images/1");
    rerender(<Markdown text="![a](1)" resolveImage={() => "javascript:alert(1)"} />);
    expect(container.querySelector("img")).toBeNull();
  });
});
