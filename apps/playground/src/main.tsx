import { ThemeProvider } from "@surfaces-ui/components";
import { SurfacesDevTools } from "@surfaces-ui/devtools";
import { type Mode, MODES, presetByName } from "@surfaces-ui/tokens";
import "@surfaces-ui/components/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { startAnalytics } from "./analytics.js";
import { ComposerPopout } from "./areas/ComposerPopout.js";
import "./app.css";

// The published site counts page views; every other build does nothing here.
startAnalytics();

const params = new URLSearchParams(location.search);
// `?theme=Sand&mode=light` opens the playground in that preset and mode for this visit only, without changing the
// appearance kept in the browser, so a link (or several frames of one page side by side) can show any preset.
const linkedTheme = presetByName(params.get("theme") ?? "");
const linkedMode = MODES.find((mode) => mode === params.get("mode")) as Mode | undefined;
const linked = Boolean(linkedTheme || linkedMode);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider initialTheme={linkedTheme ?? presetByName("Aurora")} initialMode={linkedMode ?? "dark"} storage={linked ? null : undefined}>
      {/* Dev tools for every page: on while developing, absent from a published build. `#view` frames one page alone, with nothing over it. */}
      <SurfacesDevTools enabled={import.meta.env.DEV && !location.hash.startsWith("#view")}>{params.get("popout") === "composer" ? <ComposerPopout /> : <App />}</SurfacesDevTools>
    </ThemeProvider>
  </StrictMode>,
);
