import { useEffect } from "react";
import { useComposerGuest } from "../composerSync.js";
import { ComposerPanel } from "./ComposerPanel.js";

/**
 * The composer's JSON and messages in their own window. The composer page
 * owns the state; this window shows it as it changes (an agent's messages,
 * an added component, a step) and sends its own edits back.
 */
export function ComposerPopout() {
  const { state, connected, edit } = useComposerGuest();
  useEffect(() => {
    document.title = "Surface JSON · Surfaces UI";
  }, []);
  return (
    <main className="composer-popout">
      <p className="hint" role="status">
        {connected ? "In step with the Playground page." : state ? "The Playground page has closed; edits here go nowhere until it opens again." : "Waiting for the Playground page…"}
      </p>
      {state ? (
        <ComposerPanel state={state} edit={edit} />
      ) : (
        <p className="hint">
          Open the Playground and press Pop out on its JSON tab, or keep this window open while it loads.
        </p>
      )}
    </main>
  );
}
