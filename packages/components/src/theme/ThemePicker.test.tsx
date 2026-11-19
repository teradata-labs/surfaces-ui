// @vitest-environment jsdom
import { defaultTheme, presets } from "@surfaces-ui/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemePicker } from "./ThemePicker.js";
import { type ThemeState, type ThemeStore, ThemeProvider, useTheme } from "./ThemeProvider.js";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function memoryStore(initial?: ThemeState) {
  const saved: ThemeState[] = [];
  const store: ThemeStore = { load: () => initial, save: (s) => void saved.push(s) };
  return { store, saved };
}

function Probe() {
  const { theme, mode } = useTheme();
  return <output data-testid="probe">{`${theme.name}|${mode}|${theme.radius}|${theme.light.accent}`}</output>;
}

function setup(store: ThemeStore | null = null) {
  return render(
    <ThemeProvider store={store}>
      <ThemePicker />
      <Probe />
    </ThemeProvider>,
  );
}

describe("ThemePicker", () => {
  it("applies the default theme as CSS variables", () => {
    setup();
    const style = document.querySelector("style[data-sf-theme]");
    expect(style?.textContent).toContain(`--sf-color-bg: ${defaultTheme.light.background};`);
    expect(screen.getByTestId("probe").textContent).toBe(
      `Ink|system|${defaultTheme.radius}|${defaultTheme.light.accent}`,
    );
  });

  it("switches preset and saves the choice", () => {
    const { store, saved } = memoryStore();
    setup(store);
    fireEvent.click(screen.getByRole("radio", { name: "Sand" }));
    expect(screen.getByTestId("probe").textContent).toContain("Sand|");
    expect(saved.at(-1)?.theme).toEqual(presets.find((p) => p.name === "Sand"));
    expect(document.querySelector("style[data-sf-theme]")?.textContent).toContain("--sf-radius: 10px;");
  });

  it("forces a mode on the document root", () => {
    setup();
    fireEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("radio", { name: "System" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("changes radius and accent, marking the theme custom", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Corner radius"), { target: { value: "20" } });
    expect(screen.getByTestId("probe").textContent).toContain("Custom|system|20|");
    fireEvent.change(screen.getByLabelText("Accent colour"), { target: { value: "#aa0000" } });
    expect(screen.getByTestId("probe").textContent).toContain("|#AA0000");
  });

  it("restores a saved choice from the store", async () => {
    const fern = presets.find((p) => p.name === "Sand")!;
    setup(memoryStore({ theme: fern, mode: "light" }).store);
    expect(await screen.findByText(/^Sand\|light/)).toBeTruthy();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("changes the colours charts use and checks them as they change", () => {
    const { store, saved } = memoryStore();
    setup(store);
    expect(screen.getByText(/Neighbouring series can be told apart/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Series order"), { target: { value: "Berry" } });
    expect(saved.at(-1)?.theme.charts.light.series[0]).toBe("#BE47B8");
    expect(saved.at(-1)?.theme.charts.dark.series[0]).toBe("#E76EDF");
    expect(saved.at(-1)?.theme.name).toBe("Custom");
    // The chart variables on the page follow.
    expect(document.querySelector("style[data-sf-theme]")?.textContent).toContain("--sf-series-1: #BE47B8;");

    // A colour set by hand next to a look-alike is flagged.
    fireEvent.change(screen.getByLabelText("Series 2"), { target: { value: "#c149bb" } });
    expect(screen.getByText("Colours 1 and 2 are too alike to tell apart.")).toBeTruthy();
    expect((screen.getByLabelText("Series order") as HTMLSelectElement).value).toBe("custom");
  });

  it("hides controls on request", () => {
    render(
      <ThemeProvider store={null}>
        <ThemePicker hide={["font", "density", "radius"]} />
      </ThemeProvider>,
    );
    expect(screen.queryByText("Font")).toBeNull();
    expect(screen.queryByLabelText("Corner radius")).toBeNull();
    expect(screen.getByText("Appearance")).toBeTruthy();
  });
});
