// @vitest-environment jsdom
import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider.js";

function Mode() {
  return <span data-testid="mode">{useTheme().resolvedMode}</span>;
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = () => (
  <ThemeProvider storage={null} scope="scoped">
    <Mode />
  </ThemeProvider>
);

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("ThemeProvider rendered on a server", () => {
  it("hydrates with no mismatch when the system asks for dark, then shows dark", async () => {
    // The server knows nothing of the system's choice.
    vi.stubGlobal("matchMedia", undefined);
    const html = renderToString(page());
    expect(html).toContain(">light<");
    expect(html).toContain("prefers-color-scheme: dark");

    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    const logged = vi.spyOn(console, "error").mockImplementation((...args) => errors.push(args));
    await act(async () => {
      hydrateRoot(container, page(), { onRecoverableError: (error) => errors.push(error) });
    });
    logged.mockRestore();
    expect(errors).toEqual([]);
    expect(container.querySelector("[data-testid=mode]")!.textContent).toBe("dark");
  });
});
