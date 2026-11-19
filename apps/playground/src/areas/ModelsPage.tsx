import { connectModelSettings } from "@surfaces-ui/client-connect";
import { type ModelBackend, ModelProvider } from "@surfaces-ui/proto";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { AgentPicker, KIND_LABEL } from "../AgentPicker.js";
import { useAgentChoice } from "../agentChoice.js";
import { type ActiveSource, SERVER } from "../source.js";

const PROVIDER: Record<number, string> = {
  [ModelProvider.ANTHROPIC]: "Anthropic",
  [ModelProvider.OPENAI]: "OpenAI",
  [ModelProvider.LOCAL]: "On this machine",
  [ModelProvider.LOOM]: "Loom",
};

type ServerState = { status: "loading" } | { status: "none"; reason: string } | { status: "ready"; backends: ModelBackend[] };

/**
 * Which model every agent backend runs, and which agent the playground's
 * Composer, Chat and Pages use. Keys are never entered here: a backend says
 * only which environment variable its key is read from on the server, and
 * whether it is set.
 */
export function ModelsPage({ source }: { source: ActiveSource }) {
  const serverUp = source.kind === "server";
  const choice = useAgentChoice(serverUp);
  const settings = useMemo(() => connectModelSettings({ baseUrl: SERVER }), []);
  const [server, setServer] = useState<ServerState>({ status: "loading" });
  const load = useCallback(async () => {
    if (!serverUp) return setServer({ status: "none", reason: `The dev server at ${SERVER} is not running, so only agents this page reaches itself are listed.` });
    try {
      const { backends } = await settings.listModelBackends({}, { signal: AbortSignal.timeout(5000) });
      setServer({ status: "ready", backends });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setServer({
        status: "none",
        reason: /unimplemented|not found|404/i.test(text)
          ? `The dev server at ${SERVER} has no model settings. Restart it with this repository's surfaces.config.ts (pnpm serve).`
          : `Could not read the dev server's model settings: ${text}`,
      });
    }
  }, [serverUp, settings]);
  useEffect(() => {
    void load();
  }, [load]);

  const onChanged = (backend: ModelBackend) => {
    setServer((s) => (s.status === "ready" ? { status: "ready", backends: s.backends.map((b) => (b.id === backend.id ? backend : backend.active ? { ...b, active: false } : b)) } : s));
    // The test Loom and the local models appear in the page's own picker too: look again.
    choice.refresh();
  };

  return (
    <div className="models">
      <section className="card">
        <div className="card-head">
          <h2>Agent for the Playground, Chat and Pages</h2>
          <button
            type="button"
            className="btn"
            onClick={() => {
              choice.refresh();
              void load();
            }}
            disabled={choice.probing}
          >
            {choice.probing ? "Looking…" : "Look again"}
          </button>
        </div>
        <AgentPicker choice={choice} />
        <ul className="models-reach" aria-label="Agents within reach">
          {choice.agents.map((a) => (
            <li key={a.id}>
              <span className={`badge${a.kind === "scripted" ? " warn" : ""}`}>{KIND_LABEL[a.kind]}</span> <strong>{a.label}</strong>
              <span className="hint"> {a.detail}</span>
            </li>
          ))}
        </ul>
        <p className="hint">The choice is kept in this browser. Local models and the test Loom are reached from this page; the dev server agent runs on the server with its key there.</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Dev server models</h2>
          <span className="hint">{SERVER}</span>
        </div>
        {server.status === "loading" ? (
          <p className="hint" role="status">
            Reading the dev server's model settings…
          </p>
        ) : server.status === "none" ? (
          <p className="hint" role="status">
            {server.reason}
          </p>
        ) : (
          <div className="models-grid">
            {server.backends.map((b) => (
              <BackendCard key={b.id} backend={b} settings={settings} onChanged={onChanged} />
            ))}
          </div>
        )}
        <p className="hint">
          Keys are never typed here. Each backend reads its key from the server's environment (for example <code>ANTHROPIC_API_KEY</code>): put it in the
          git-ignored <code>.env.local</code> beside <code>surfaces.config.ts</code>, or in your shell, restart the server and look again.
        </p>
      </section>
    </div>
  );
}

function BackendCard({ backend, settings, onChanged }: { backend: ModelBackend; settings: ReturnType<typeof connectModelSettings>; onChanged(b: ModelBackend): void }) {
  const id = useId();
  const listed = backend.models.some((m) => m.id === backend.model);
  const [model, setModel] = useState(listed || !backend.anyModel ? backend.model : "__other");
  const [other, setOther] = useState(listed ? "" : backend.model);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean; busy?: boolean }>({ text: "" });
  const chosen = model === "__other" ? other.trim() : model;
  const changed = chosen !== backend.model;
  const restarts = backend.provider === ModelProvider.LOOM;

  const apply = async (makeActive: boolean) => {
    if (restarts && changed && !confirming) return setConfirming(true);
    setConfirming(false);
    setStatus({ text: restarts && changed ? "Restarting the test Loom with the new model…" : "Saving…", busy: true });
    try {
      const { backend: after } = await settings.setModel({ backendId: backend.id, model: chosen || backend.model, makeActive });
      if (after) onChanged(after);
      setStatus({ text: `${after?.label ?? backend.label} now uses ${after?.model ?? chosen}${makeActive ? " and answers the dev server's turns" : ""}.` });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), error: true });
    }
  };

  return (
    <article className="models-card" aria-labelledby={`${id}-title`} data-active={backend.active || undefined}>
      <div className="card-head">
        <h3 id={`${id}-title`}>{backend.label}</h3>
        {backend.active && <span className="badge">Answers dev server turns</span>}
      </div>
      <p className="hint">
        {PROVIDER[backend.provider] ?? "Other"}. {backend.description}
      </p>
      <p className={backend.available ? "hint" : "catalog-error"}>
        <span aria-hidden="true">{backend.available ? "✓ " : "✕ "}</span>
        {backend.available ? "Can run." : backend.keyEnv && !backend.keySet ? "Cannot run:" : backend.reason || "Cannot run."}
        {backend.keyEnv && (
          <>
            {" "}
            Key: <code>{backend.keyEnv}</code> {backend.keySet ? "is set" : "is not set"} on the server.
          </>
        )}
      </p>
      <label className="models-field">
        <span>Model</span>
        <select
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setConfirming(false);
          }}
        >
          {!listed && !backend.anyModel && backend.model && <option value={backend.model}>{backend.model}</option>}
          {backend.models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label || m.id}
              {m.id === backend.model ? " (now)" : ""}
            </option>
          ))}
          {backend.anyModel && <option value="__other">Another model id…</option>}
        </select>
      </label>
      {model === "__other" && (
        <label className="models-field">
          <span>Model id</span>
          <input type="text" value={other} onChange={(e) => setOther(e.target.value)} placeholder="e.g. claude-sonnet-5-5" spellCheck={false} />
        </label>
      )}
      {backend.models.find((m) => m.id === chosen)?.description && <p className="hint">{backend.models.find((m) => m.id === chosen)?.description}</p>}
      {backend.changeNote && <p className="hint">{backend.changeNote}</p>}
      <div className="models-actions">
        <button type="button" className="btn primary" disabled={status.busy || !chosen || (!changed && !confirming)} onClick={() => void apply(false)}>
          {confirming ? "Yes, restart it" : restarts ? "Restart with this model" : "Use this model"}
        </button>
        {confirming && (
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        )}
        {!backend.active && backend.provider !== ModelProvider.LOOM && (
          <button type="button" className="btn" disabled={status.busy || !chosen || !backend.available} onClick={() => void apply(true)}>
            Answer dev server turns
          </button>
        )}
      </div>
      {confirming && (
        <p className="hint" role="status">
          This restarts the test Loom; conversations on it end. Press again to go ahead.
        </p>
      )}
      {status.text && (
        <p className={status.error ? "catalog-error" : "hint"} role={status.error ? "alert" : "status"}>
          {status.text}
        </p>
      )}
    </article>
  );
}
