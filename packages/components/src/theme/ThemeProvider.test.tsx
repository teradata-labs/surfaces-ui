// @vitest-environment jsdom
import { act, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { cleanup, render, screen } from "@testing-library/react";
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

describe("ThemeProvider kept in step by a host", () => {
  afterEach(cleanup);

  it("does not render again and again when a host sets the mode from an effect", () => {
    let renders = 0;
    function FollowHost({ mode }: { mode: "light" | "dark" }) {
      const { setMode, resolvedMode } = useTheme();
      renders++;
      // A host's own toggle, passed on the way a site with next-themes would: setMode in its dependencies.
      useEffect(() => setMode(mode), [mode, setMode]);
      return <span data-testid="mode">{resolvedMode}</span>;
    }
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const view = render(
      <ThemeProvider storage={null} scope="scoped">
        <FollowHost mode="dark" />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("mode").textContent).toBe("dark");
    const settled = renders;
    view.rerender(
      <ThemeProvider storage={null} scope="scoped">
        <FollowHost mode="dark" />
      </ThemeProvider>,
    );
    expect(renders - settled).toBeLessThanOrEqual(2);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
