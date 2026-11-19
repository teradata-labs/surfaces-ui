import { CodeBlock, Markdown, type AppComponentDoc, appComponentCode } from "@surfaces-ui/components";
import { useCallback, useMemo, useRef, useState } from "react";
import { CodeInput } from "../CodeInput.js";
import { type JsonSchema, SchemaForm } from "../SchemaForm.js";
import { AppDemo } from "../appDemos.js";
import type { ActiveSource } from "../source.js";

interface Called {
  at: string;
  prop: string;
  detail?: string;
}

const brief = (value: unknown) => {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
};

export const startingParts = (doc: AppComponentDoc) => new Set(doc.parts.filter((p) => p.required || p.on).map((p) => p.prop));

/**
 * One app component's page: drawn live as a plain React component, its
 * plain-data props in a form or as JSON, its parts that take code switched on
 * and off (each filled with a working demo), the JSX for what is on, and a
 * log of what it calls back.
 */
export function AppComponentPage({ doc, source }: { doc: AppComponentDoc; source: ActiveSource }) {
  const [text, setText] = useState(() => JSON.stringify(doc.example, null, 2));
  const [parts, setParts] = useState(() => startingParts(doc));
  const [called, setCalled] = useState<Called[]>([]);
  const [propsView, setPropsView] = useState<"form" | "json">("form");

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(text) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Props must be a JSON object." };
      return { props: value as Record<string, unknown> };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [text]);
  const lastGood = useRef<Record<string, unknown>>(doc.example);
  if (parsed.props) lastGood.current = parsed.props;
  const shown = lastGood.current;

  const log = useCallback(
    (prop: string, value?: unknown) => setCalled((list) => [{ at: new Date().toLocaleTimeString(), prop, detail: brief(value) }, ...list].slice(0, 30)),
    [],
  );
  const setProp = (prop: string, value: unknown) => setText((current) => {
    try {
      return JSON.stringify({ ...(JSON.parse(current) as object), [prop]: value }, null, 2);
    } catch {
      return current;
    }
  });
  const toggle = (prop: string) =>
    setParts((current) => {
      const next = new Set(current);
      if (next.has(prop)) next.delete(prop);
      else next.add(prop);
      return next;
    });
  // A part switched on or off draws the component again from the start, as a host passing it from the first render would.
  const partsKey = [...parts].sort().join(",");
  const required = new Set(doc.props.required ?? []);
  const plain = Object.entries(doc.props.properties);

  return (
    <div className="catalog-main">
      <section className="card catalog-head">
        <h2 className="catalog-name">{doc.name}</h2>
        <p className="hint">
          <code>{`import { ${doc.name} } from "${doc.from}";`}</code> An app component: placed by the app in React, not drawn by an agent.
        </p>
        <Markdown text={doc.description} />
      </section>

      <section className="card" aria-label="Preview">
        <div className="card-head">
          <h2>Preview</h2>
          <span className="hint">The component itself, with the props and parts below</span>
        </div>
        <div className="catalog-preview app-preview sf-container">
          <AppDemo key={`${doc.name}:${partsKey}`} name={doc.name} props={shown} parts={parts} source={source} log={log} setProp={setProp} />
        </div>
      </section>

      <div className="catalog-split">
        <section className="card" aria-label="Props">
          <div className="card-head">
            <h2>Props</h2>
            <button type="button" className="btn" onClick={() => setText(JSON.stringify(doc.example, null, 2))}>
              Reset to example
            </button>
          </div>
          {plain.length === 0 ? (
            <p className="hint">{doc.name} takes no plain-data props beyond its parts.</p>
          ) : (
            <>
              <div className="tabs" role="tablist" aria-label="Edit props as">
                {(["form", "json"] as const).map((view) => (
                  <button key={view} type="button" role="tab" aria-selected={propsView === view} onClick={() => setPropsView(view)}>
                    {view === "form" ? "Form" : "JSON"}
                  </button>
                ))}
              </div>
              {propsView === "form" ? (
                parsed.error ? (
                  <p className="catalog-error" role="alert">
                    The JSON does not parse, so the form is paused: {parsed.error} Fix it in the JSON tab.
                  </p>
                ) : (
                  <SchemaForm schema={doc.props as JsonSchema} value={shown} onChange={(next) => setText(JSON.stringify(next, null, 2))} />
                )
              ) : (
                <>
                  <CodeInput language="json" label={`${doc.name} props as JSON`} invalid={!!parsed.error} value={text} onChange={setText} />
                  {parsed.error && (
                    <p className="catalog-error" role="alert">
                      Not drawn: {parsed.error}
                    </p>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="card" aria-label="Parts">
          <div className="card-head">
            <h2>Parts</h2>
            <span className="hint">Props that take code; here each is a working demo</span>
          </div>
          {doc.parts.length === 0 ? (
            <p className="hint">{doc.name} needs nothing in code beyond its callbacks.</p>
          ) : (
            <ul className="app-parts">
              {doc.parts.map((part) => (
                <li key={part.prop}>
                  <label>
                    <input type="checkbox" checked={parts.has(part.prop)} disabled={part.required} onChange={() => toggle(part.prop)} />
                    <span>
                      <strong>{part.label}</strong> <code>{part.prop}</code>
                      {part.required && <span className="hint"> required</span>}
                    </span>
                  </label>
                  <Markdown text={part.description} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="catalog-split">
        <section className="card" aria-label="Code">
          <div className="card-head">
            <h2>Code</h2>
            <span className="hint">The JSX for what is shown</span>
          </div>
          <CodeBlock code={appComponentCode(doc, shown, [...parts])} language="ts" label={`${doc.name} as JSX`} />
        </section>

        <section className="card" aria-label="Callbacks">
          <div className="card-head">
            <h2>Callbacks</h2>
            {called.length > 0 && (
              <button type="button" className="btn" onClick={() => setCalled([])}>
                Clear
              </button>
            )}
          </div>
          {doc.callbacks.length === 0 ? (
            <p className="hint">{doc.name} calls nothing back. It only shows what it is given.</p>
          ) : (
            <dl className="catalog-events">
              {doc.callbacks.map((callback) => (
                <div key={callback.prop}>
                  <dt>{callback.prop}</dt>
                  <dd>
                    <Markdown inline text={callback.description} />
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <h3 className="catalog-sub">Called</h3>
          <div role="status">
            {called.length === 0 ? (
              <p className="hint">Nothing yet. Use the preview.</p>
            ) : (
              <ol className="app-calls">
                {called.map((call, i) => (
                  <li key={`${call.at}-${i}`}>
                    <span className="hint">{call.at}</span> <code>{call.prop}</code> {call.detail && <span>{call.detail}</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>

      {plain.length > 0 && (
        <section className="card" aria-label="Props reference">
          <div className="card-head">
            <h2>Props reference</h2>
            <span className="hint">From {doc.from}'s appComponents.ts, checked against the props type</span>
          </div>
          <table className="catalog-props">
            <thead>
              <tr>
                <th scope="col">Prop</th>
                <th scope="col">Type</th>
                <th scope="col">About</th>
              </tr>
            </thead>
            <tbody>
              {plain.map(([prop, schema]) => (
                <tr key={prop}>
                  <td>
                    <code>{prop}</code>
                    {!required.has(prop) && <span className="hint"> optional</span>}
                  </td>
                  <td>
                    <code>{schema.enum ? schema.enum.map((v) => JSON.stringify(v)).join(" | ") : schema.type === "array" ? `${schema.items?.type ?? "value"}[]` : (schema.type ?? "object")}</code>
                  </td>
                  <td>
                    <Markdown inline text={schema.description ?? ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
