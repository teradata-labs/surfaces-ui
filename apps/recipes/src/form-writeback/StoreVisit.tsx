import { connectForms } from "@surfaces-ui/client-connect";
import { FormsProvider } from "@surfaces-ui/components";
import { type SurfaceAction, analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, analyticsRenderers } from "@surfaces-ui/spec/react";
import { useMemo } from "react";
import { storeVisitPage } from "./page.js";

export interface StoreVisitProps {
  /** Where the dev server is, e.g. http://localhost:5220; or a transport of your own. */
  server: Parameters<typeof connectForms>[0];
  /** Called after the server stored a visit, with its values as stored and the submission id. */
  onAction?(action: SurfaceAction): void;
}

/** In the browser: the page, with its Form sending to the server's FormService. */
export function StoreVisit({ server, onAction }: StoreVisitProps) {
  const forms = useMemo(() => connectForms(server), [server]);
  const surface = useMemo(() => pageSurface(storeVisitPage), []);
  return (
    <FormsProvider forms={forms}>
      <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={(action) => onAction?.(action)} />
    </FormsProvider>
  );
}
