// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CHAT_ICONS, ChatIcon } from "./icons.js";
import { MenuButton } from "./Menu.js";

afterEach(cleanup);

describe("ChatIcon", () => {
  it("draws every name it has, as a hidden outline", () => {
    expect(CHAT_ICONS).toEqual(expect.arrayContaining(["more", "bell", "chevron"]));
    for (const name of CHAT_ICONS) {
      const { container } = render(<ChatIcon name={name} />);
      const svg = container.querySelector("svg.sf-chat-icon")!;
      expect(svg.getAttribute("aria-hidden"), name).toBe("true");
      expect(svg.querySelector("path")!.getAttribute("d"), name).toMatch(/^M/);
      cleanup();
    }
  });

  it("makes an icon-only overflow menu with more", () => {
    render(
      <MenuButton iconOnly icon="more" label="More for Sales">
        {() => <button type="button">Rename</button>}
      </MenuButton>,
    );
    const button = screen.getByRole("button", { name: "More for Sales" });
    // Only the dots: no text and no chevron.
    expect(button.querySelectorAll("svg")).toHaveLength(1);
    expect(button.textContent).toBe("");
    expect(button.getAttribute("title")).toBe("More for Sales");
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "More for Sales" })).toBeTruthy();
  });
});
