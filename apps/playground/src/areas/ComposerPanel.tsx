import { CodeBlock } from "@surfaces-ui/components";
import type { SurfaceMessage } from "@surfaces-ui/spec";
import { type KeyboardEvent, useId, useMemo, useRef, useState } from "react";
import { CodeInput } from "../CodeInput.js";
import { describe, parseMessages, parseSpec, pretty } from "../composerText.js";
import type { ComposerEdit, ComposerState, ComposerTab } from "../composerSync.js";

/**
 * The messages the text makes. While the text does not parse, the last
 * messages that did are kept, so the surface stays on screen.
 */
export function useComposerMessages(tab: ComposerTab, a2uiText: string, specText: string) {
  const parsed = useMemo(() => (tab === "a2ui" ? parseMessages(a2uiText) : parseSpec(specText)), [tab, a2uiText, specText]);
  const lastGood = useRef<SurfaceMessage[]>([]);
  if ("messages" in parsed) lastGood.current = parsed.messages;
  return { messages: lastGood.current, parseError: "error" in parsed ? parsed.error : "" };
}

type View = "json" | "messages";

/** Arrow keys, Home and End move between tabs, as the ARIA tabs pattern asks. */
function rovingKeys<T extends string>(ids: T[], current: T, choose: (id: T) => void, domId: (id: T) => string) {
  return (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const index = ids.indexOf(current);
    const next = event.key === "Home" ? 0 : event.key === "End" ? ids.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
    choose(ids[next]!);
    document.getElementById(domId(ids[next]!))?.focus();
  };
}

export interface ComposerPanelProps {
  state: ComposerState;
  edit(change: ComposerEdit): void;
  /** Puts the example back; absent in a popped-out window. */
  onReset?(): void;
  /** Opens the panel in its own window; absent in that window. */
  onPopOut?(): void;
  /** True while a popped-out window is open. */
  poppedOut?: boolean;
}

/**
 * The composer's text and its messages, as two tabs: the JSON (A2UI messages
 * or a json-render spec) and the message stepper. The same panel is drawn on
 * the composer page and in a popped-out window; both edit one state.
 */
export function ComposerPanel({ state, edit, onReset, onPopOut, poppedOut }: ComposerPanelProps) {
  const id = useId();
  const [view, setView] = useState<View>("json");
  const { tab, a2uiText, specText, loadStatus } = state;
  const { messages, parseError } = useComposerMessages(tab, a2uiText, specText);
  const total = messages.length;
  const applied = Math.min(state.step, total);

  const views: { id: View; label: string }[] = [
    { id: "json", label: "JSON" },
    { id: "messages", label: `Messages (${applied}/${total})` },
  ];
  const formats: { id: ComposerTab; label: string }[] = [
    { id: "a2ui", label: "A2UI messages" },
    { id: "jsonrender", label: "json-render spec" },
  ];
  const viewId = (v: View) => `${id}-view-${v}`;
  const formatId = (f: ComposerTab) => `${id}-format-${f}`;

  return (
    <section className="card composer-panel" aria-label="Surface JSON">
      <div className="card-head">
        <div className="tabs" role="tablist" aria-label="Surface JSON">
          {views.map((v) => (
            <button
              key={v.id}
              id={viewId(v.id)}
              type="button"
              role="tab"
              className="composer-tab"
              aria-selected={view === v.id}
              aria-controls={`${id}-panel`}
              tabIndex={view === v.id ? 0 : -1}
              onKeyDown={rovingKeys(
                views.map((x) => x.id),
                view,
                setView,
                viewId,
              )}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        {poppedOut && <span className="badge">Open in another window</span>}
        {onPopOut && (
          <button type="button" className="btn" onClick={onPopOut} title="Opens this panel in its own window; both stay in step">
            Pop out
          </button>
        )}
      </div>

      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={viewId(view)} className="composer-editor">
        {view === "json" ? (
          <>
            <div className="card-head">
              <div className="tabs" role="tablist" aria-label="Write as">
                {formats.map((f) => (
                  <button
                    key={f.id}
                    id={formatId(f.id)}
                    type="button"
                    role="tab"
                    className="composer-tab"
                    aria-selected={tab === f.id}
                    tabIndex={tab === f.id ? 0 : -1}
                    onKeyDown={rovingKeys(
                      formats.map((x) => x.id),
                      tab,
                      (t) => edit({ tab: t }),
                      formatId,
                    )}
                    onClick={() => edit({ tab: f.id })}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {onReset && (
                <button type="button" className="btn" onClick={onReset}>
                  Reset to example
                </button>
              )}
            </div>
            {tab === "a2ui" ? (
              <CodeInput language="json" label="A2UI messages as a JSON array" invalid={!!parseError} value={a2uiText} onChange={(text) => edit({ a2uiText: text })} />
            ) : (
              <>
                <CodeInput language="json" label="json-render spec as JSON" invalid={!!parseError} value={specText} onChange={(text) => edit({ specText: text })} />
                <div className="card-head">
                  <h3 className="catalog-sub">Converted to A2UI</h3>
                  <button type="button" className="btn" disabled={!!parseError} onClick={() => edit({ a2uiText: pretty(messages), tab: "a2ui" })}>
                    Edit as A2UI messages
                  </button>
                </div>
                <CodeBlock code={pretty(messages)} language="json" label="The spec as A2UI messages" />
              </>
            )}
            {parseError && (
              <p className="catalog-error" role="alert">
                Not applied: {parseError}. The last messages that parsed are still drawn.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="composer-stepper" role="group" aria-label="Step through messages">
              <button type="button" className="btn" disabled={applied === 0} onClick={() => edit({ step: 0 })}>
                First
              </button>
              <button type="button" className="btn" disabled={applied === 0} onClick={() => edit({ step: applied - 1 })}>
                Previous
              </button>
              <button type="button" className="btn" disabled={applied >= total} onClick={() => edit({ step: applied + 1 })}>
                Next
              </button>
              <button type="button" className="btn" disabled={applied >= total} onClick={() => edit({ step: total })}>
                All
              </button>
            </div>
            <p className="hint" role="status">
              {total === 0 ? "No messages." : applied === 0 ? `None of ${total} messages applied.` : `${applied} of ${total} applied. Last: ${describe(messages[applied - 1])}.`}
            </p>
            <ol className="composer-messages">
              {messages.map((message, index) => (
                <li key={index} data-applied={index < applied || undefined}>
                  <button type="button" className="composer-message" aria-current={index === applied - 1 ? "step" : undefined} onClick={() => edit({ step: index + 1 })}>
                    <span className="composer-mark" aria-hidden="true">
                      {index < applied ? "●" : "○"}
                    </span>
                    <span>
                      {index + 1}. {describe(message)}
                    </span>
                    <span className="hint">{index < applied ? "applied" : "not applied"}</span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        )}
        {loadStatus && (
          <p className="hint" role="status">
            {loadStatus}
          </p>
        )}
      </div>
    </section>
  );
}
