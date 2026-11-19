import { SurfacesDevTools } from "@surfaces-ui/devtools";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Dev tools: a button at the corner (or Ctrl+Shift+D) shows what an agent sent and what the page did with it.
        On while developing, absent from a production build. */}
    <SurfacesDevTools>
      <App />
    </SurfacesDevTools>
  </StrictMode>,
);
