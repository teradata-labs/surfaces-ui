import { Chat } from "@surfaces-ui/chat";
import { connectAgent, connectDataSource } from "@surfaces-ui/client-connect";
import { DataSourceProvider, ThemePicker, ThemeProvider } from "@surfaces-ui/components";
import { analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { browserStorage } from "@surfaces-ui/state";
import { useMemo, useState } from "react";
import "@surfaces-ui/components/styles.css";
import "./app.css";
import { dashboard } from "./dashboard";

// The data server (`npm run serve`). Queries and the agent run there; the browser only draws.
const server = import.meta.env.VITE_SURFACES_URL ?? "http://localhost:5220";
const data = connectDataSource({ baseUrl: server });
const agent = connectAgent({ baseUrl: server });
const storage = browserStorage();

export function App() {
  const [tab, setTab] = useState<"dashboard" | "chat">("dashboard");
  const surface = useMemo(() => pageSurface(dashboard), []);
  return (
    <ThemeProvider>
      <DataSourceProvider dataSource={data}>
        <header className="app-header">
          <h1>__TITLE__</h1>
          <nav aria-label="Pages">
            <button type="button" className="sf-button" aria-pressed={tab === "dashboard"} onClick={() => setTab("dashboard")}>
              Dashboard
            </button>
            <button type="button" className="sf-button" aria-pressed={tab === "chat"} onClick={() => setTab("chat")}>
              Chat
            </button>
          </nav>
          <details className="app-theme">
            <summary>Theme</summary>
            <ThemePicker />
          </details>
        </header>
        <main className="app-main">
          {tab === "dashboard" ? (
            <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} />
          ) : (
            <Chat agent={agent} storage={storage} height="calc(100dvh - 8rem)" starters={["Show revenue by month as a chart", "Which stores sell the most?", "Show returns by reason"]} />
          )}
        </main>
      </DataSourceProvider>
    </ThemeProvider>
  );
}
