// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge.js";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("reads as its words, with the tone for styling only", () => {
    const { container } = render(<StatusBadge label="Turned off" tone="danger" />);
    const badge = container.querySelector(".sf-status")!;
    expect(badge.textContent).toBe("Turned off");
    expect(badge.getAttribute("data-tone")).toBe("danger");
    expect(badge.querySelector(".sf-status-mark")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("is neutral unless told otherwise", () => {
    const { container } = render(<StatusBadge label="Invited" />);
    expect(container.querySelector(".sf-status")!.getAttribute("data-tone")).toBe("neutral");
  });

  it("reads its description after the words and shows it on hover", () => {
    render(<StatusBadge label="Turned off" description="by Ana on 3 May" />);
    expect(screen.getByText("Turned off", { exact: false }).closest(".sf-status")!.textContent).toBe("Turned off: by Ana on 3 May");
    expect(screen.getByTitle("by Ana on 3 May")).toBeTruthy();
  });
});
