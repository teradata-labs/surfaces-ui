import { A2UI_VERSION, type PageDocument, type SurfaceAction, pageSurface, shapeText, toJsonRender, toMarkup } from "@surfaces-ui/spec";
import { type SurfaceProblem, SurfaceView } from "@surfaces-ui/spec/react";
import { COMPONENT_NAMES, COMPONENT_SCHEMA, catalogOf, definitionOf, markupOf, renderersOf } from "../componentCatalogs.js";
import { chatAppComponents } from "@surfaces-ui/chat";
import { appComponentDocs as devtoolsAppComponents } from "@surfaces-ui/devtools/app-components";
import { CodeBlock, Markdown, PipelinesProvider, SegmentedControl, ThemeProvider, componentsAppComponents, useOptionalTheme } from "@surfaces-ui/components";
import { presets } from "@surfaces-ui/tokens";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CodeInput } from "../CodeInput.js";
import { type JsonSchema, SchemaForm } from "../SchemaForm.js";
import { GROUPS, exampleProps, rowTemplate } from "../catalogExamples.js";
import { AppComponentPage, startingParts } from "./AppComponentPage.js";
import { AppDemo } from "../appDemos.js";
import { ComponentInventory, type InventoryItem } from "./ComponentInventory.js";
import { focusFor, useThirds } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";

const SCHEMA = COMPONENT_SCHEMA as Record<
  string,
  { description: string; properties?: Record<string, { type?: string; enum?: unknown[]; description?: string }>; required?: string[] }
>;
const NAMES = COMPONENT_NAMES;
const grouped = (() => {
  const listed = new Set(GROUPS.flatMap(([, names]) => names));
  const groups = GROUPS.map(([label, names]) => [label, names.filter((n) => NAMES.includes(n))] as const);
  const other = NAMES.filter((n) => !listed.has(n));
  return other.length ? [...groups, ["Other", other] as const] : groups;
})();
/** Components an app places itself: no catalog entry, a page of their own. */
const APP_DOCS = [...chatAppComponents, ...componentsAppComponents, ...devtoolsAppComponents].filter(
  // NavBar is also in the site catalog; it is listed once, there, and drawn the way an agent's page draws it.
  (doc) => !NAMES.includes(doc.name),
);
const APP = new Map(APP_DOCS.map((doc) => [doc.name, doc]));
const LIST = [...grouped, ["App components", APP_DOCS.map((doc) => doc.name)] as const];

/** The overview of every component: the page the area opens on when no component is named. */
const OVERVIEW = "";

/** A card's demo is a picture: what it reports goes nowhere. */
const ignore = () => {};

/**
 * A card draws at twice its size and is shrunk by half, so it shows about 270px of height. A component whose example
 * asks for more (a chat) is drawn at that height, so its composer and starters are in the picture.
 */
const THUMB_HEIGHT = 270;
function thumbProps(example: Record<string, unknown>): Record<string, unknown> {
  return typeof example.height === "number" ? { ...example, height: THUMB_HEIGHT } : example;
}

/** A description's first sentence, without Markdown marks, for a card. */
function firstSentence(text: string): string {
  const plain = text.replace(/[`*_]/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();
  const end = plain.search(/\.(\s|$)/);
  return end === -1 ? plain : plain.slice(0, end + 1);
}

/**
 * A one-component page. Layout examples name children that do not exist,
 * so each named child is drawn as a labelled placeholder.
 */
function previewPage(name: string, props: Record<string, unknown>): PageDocument {
  const children = [
    ...(Array.isArray(props.children) ? props.children : []),
    ...(typeof props.child === "string" ? [props.child] : []),
    // A showcase names a child for each example.
    ...(Array.isArray(props.examples) ? (props.examples as { child?: unknown }[]).map((example) => example.child) : []),
  ].filter((c): c is string => typeof c === "string");
  return {
    id: "preview",
    title: name,
    catalogId: catalogOf(name).id,
    components: [
      { id: "root", component: name, ...props },
      // A list of rows draws its child once per row, so its child reads the row.
      ...((name === "RowList" ? rowTemplate(props) : undefined) ?? [
        ...children.map((child) => ({ id: child, component: "Card", child: `${child}-text` })),
        ...children.map((child) => ({ id: `${child}-text`, component: "Text", text: `Child "${child}"`, variant: "caption" })),
      ]),
    ],
    data: props.value && typeof props.value === "object" && "path" in props.value ? {} : undefined,
  };
}

/** A prop's shape as the agent's prompt writes it, so the page and the prompt never disagree. */
const typeOf = (shape: unknown): string => shapeText(shape);

/** Pipeline components need a pipeline backend; only the dev server has one. */
function MaybePipelines({ source, children }: { source: ActiveSource; children: ReactNode }) {
  return source.pipelines ? <PipelinesProvider pipelines={source.pipelines}>{children}</PipelinesProvider> : children;
}

/** How the code card writes the preview: as JSX, as the A2UI an agent sends, or as a json-render spec. */
const CODE_VIEWS = [
  { id: "react", label: "React", about: "The same surface written as JSX, with the catalog's props" },
  { id: "a2ui", label: "A2UI", about: "The message an agent sends to draw it" },
  { id: "json-render", label: "json-render", about: "A json-render spec that converts to the same surface" },
] as const;
type CodeView = (typeof CODE_VIEWS)[number]["id"];
const CODE_KEY = "surfaces.catalog.code";

function storedCodeView(): CodeView {
  try {
    const saved = localStorage.getItem(CODE_KEY);
    return CODE_VIEWS.some((v) => v.id === saved) ? (saved as CodeView) : "react";
  } catch {
    return "react";
  }
}

/** One surface written three ways, with a tab for each; the choice is kept for the next component. */
export function SurfaceCode({ page }: { page: PageDocument }) {
  const [view, setView] = useState<CodeView>(storedCodeView);
  const choose = (next: CodeView) => {
    setView(next);
    try {
      localStorage.setItem(CODE_KEY, next);
    } catch {
      // A private window keeps the choice for this page only.
    }
  };
  const code = useMemo(() => {
    if (view === "react") return `import { ${markupOf(String(page.components[0]?.component ?? ""))} as Ui } from "@surfaces-ui/spec/react";\n\nexport const View = () => (\n${toMarkup(page.components).replace(/^/gm, "  ")}\n);`;
    if (view === "a2ui") return JSON.stringify({ version: A2UI_VERSION, updateComponents: { surfaceId: "main", components: page.components } }, null, 2);
    return JSON.stringify(toJsonRender(page.components, { data: page.data }), null, 2);
  }, [view, page]);
  const current = CODE_VIEWS.find((v) => v.id === view)!;
  return (
    <section className="card catalog-code" aria-label="Code">
      <div className="card-head">
        <h2>Code</h2>
        <span className="hint">{current.about}</span>
      </div>
      <SegmentedControl className="catalog-code-views" label="Write it as" value={view} onChange={choose} options={CODE_VIEWS.map((v) => ({ value: v.id, label: v.label }))} />
      <CodeBlock code={code} language={view === "react" ? "tsx" : "json"} label={`${current.label} code`} />
    </section>
  );
}

type PreviewMode = "page" | "light" | "dark";

/**
 * The preview in a theme and mode of its own, without changing the page's: the page's theme is the starting point,
 * so "Page" with the page's preset draws it exactly as the rest of the page.
 */
function PreviewAppearance({ preset, mode, children }: { preset: string; mode: PreviewMode; children: ReactNode }) {
  const page = useOptionalTheme();
  if (preset === "page" && mode === "page") return children;
  const theme = presets.find((p) => p.name === preset) ?? page?.theme;
  const resolved = mode === "page" ? (page?.resolvedMode ?? "light") : mode;
  return (
    <ThemeProvider key={`${preset}-${resolved}`} scope="scoped" storage={null} initialTheme={theme} initialMode={resolved}>
      <div className="catalog-preview-scope">{children}</div>
    </ThemeProvider>
  );
}

export function ComponentCatalog({ source }: { source: ActiveSource }) {
  const [name, setName] = useState(() => new URLSearchParams(location.search).get("component") ?? OVERVIEW);
  const [filter, setFilter] = useState("");
  const [text, setText] = useState(() => JSON.stringify(exampleProps(name, source), null, 2));
  const [events, setEvents] = useState<SurfaceAction[]>([]);
  const [problems, setProblems] = useState<SurfaceProblem[]>([]);
  const [data, setData] = useState<unknown>(undefined);
  const [propsView, setPropsView] = useState<"form" | "json">("form");
  const [previewPreset, setPreviewPreset] = useState("page");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("page");
  const focus = focusFor(source.sourceId, firstTable(source));
  const thirds = useThirds(source.dataSource, source.sourceId, focus.amount.sql, focus.amount.column);
  // The bullet graph's bands come from the data, once the engine has worked them out.
  useEffect(() => {
    if (name === "BulletGraph" && thirds) setText(JSON.stringify(exampleProps(name, source, thirds), null, 2));
    // biome-ignore lint/correctness/useExhaustiveDependencies: only when the bands arrive.
  }, [thirds]);

  const choose = (next: string) => {
    setName(next);
    setText(JSON.stringify(exampleProps(next, source, thirds), null, 2));
    setEvents([]);
    setData(undefined);
    const url = new URL(location.href);
    if (next === OVERVIEW) url.searchParams.delete("component");
    else url.searchParams.set("component", next);
    history.replaceState(null, "", url);
    if (next !== name) window.scrollTo({ top: 0 });
  };

  // Every component as a card: the catalog's own example over the picked data, or an app component's description.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the examples change only with the source and the bands.
  const inventory = useMemo(
    () =>
      LIST.map(
        ([label, names]) =>
          [
            label,
            names.map((n): InventoryItem => {
              const app = APP.get(n);
              if (app)
                return {
                  name: n,
                  summary: firstSentence(app.description),
                  tags: ["app"],
                  draw: () => <AppDemo name={n} props={thumbProps(app.example)} parts={startingParts(app)} source={source} log={ignore} setProp={ignore} />,
                };
              return {
                name: n,
                summary: firstSentence(SCHEMA[n]?.description ?? ""),
                page: previewPage(n, exampleProps(n, source, thirds)),
                tags: definitionOf(n)?.events ? ["events"] : [],
              };
            }),
          ] as const,
      ),
    [source, thirds],
  );

  const parsed = useMemo(() => {
    try {
      const value = JSON.parse(text) as unknown;
      if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Props must be a JSON object." };
      return { props: value as Record<string, unknown> };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [text]);
  // While the JSON does not parse, the last props that did stay on screen.
  const lastGood = useRef<Record<string, unknown>>(exampleProps(name, source));
  if (parsed.props) lastGood.current = parsed.props;
  const shown = lastGood.current;
  const shownKey = JSON.stringify(shown);
  // biome-ignore lint/correctness/useExhaustiveDependencies: shownKey stands for shown.
  const page = useMemo(() => previewPage(name, shown), [name, shownKey]);
  const surface = useMemo(() => pageSurface(page), [page]);
  useEffect(() => setProblems([]), [surface]);

  const schema = SCHEMA[name];
  const required = new Set(schema?.required ?? []);
  const props = Object.entries(schema?.properties ?? {}).filter(([p]) => p !== "id" && p !== "component" && p !== "accessibility");
  const declared = definitionOf(name)?.events ?? {};
  const needle = filter.trim().toLowerCase();

  return (
    <div className="catalog">
      <nav className="catalog-list card" aria-label="Components">
        <button type="button" className="catalog-overview" aria-current={name === OVERVIEW ? "true" : undefined} onClick={() => choose(OVERVIEW)}>
          All components
        </button>
        <input className="catalog-filter" type="search" placeholder={`Filter ${NAMES.length + APP_DOCS.length} components`} aria-label="Filter components" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {LIST.map(([label, names]) => {
          const visible = names.filter((n) => !needle || n.toLowerCase().includes(needle));
          if (visible.length === 0) return null;
          return (
            <section key={label}>
              <h2 className="shell-group-label">{label}</h2>
              <ul>
                {visible.map((n) => (
                  <li key={n}>
                    <button type="button" aria-current={n === name ? "true" : undefined} onClick={() => choose(n)}>
                      {n}
                      {definitionOf(n)?.events && <span className="catalog-tag">events</span>}
                      {APP.has(n) && <span className="catalog-tag">app</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>

      {name === OVERVIEW ? (
        <MaybePipelines source={source}>
          <ComponentInventory groups={inventory} filter={filter} onFilter={setFilter} onOpen={choose} />
        </MaybePipelines>
      ) : APP.has(name) ? (
        <AppComponentPage key={name} doc={APP.get(name)!} source={source} />
      ) : (
      <div className="catalog-main">
        <section className="card catalog-head">
          <h2 className="catalog-name">{name}</h2>
          <Markdown text={schema?.description ?? ""} />
        </section>

        <section className="card" aria-label="Preview">
          <div className="card-head">
            <h2>Preview</h2>
            <span className="hint">Drawn from the props below, through the catalog, exactly as an agent's surface would be</span>
          </div>
          <div className="catalog-appearance" role="group" aria-label="Preview appearance">
            <SegmentedControl<PreviewMode>
              label="Preview mode"
              value={previewMode}
              onChange={setPreviewMode}
              options={[
                { value: "page", label: "As the page" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
            <label className="catalog-appearance-preset">
              <span className="hint">Theme</span>
              <select className="schema-field" value={previewPreset} onChange={(e) => setPreviewPreset(e.target.value)}>
                <option value="page">As the page</option>
                {presets.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="catalog-preview sf-container">
            <PreviewAppearance preset={previewPreset} mode={previewMode}>
            <MaybePipelines source={source}>
            <SurfaceView
              surface={surface}
              catalog={catalogOf(name)}
              renderers={renderersOf(name)}
              onAction={(action) => setEvents((list) => [action, ...list].slice(0, 20))}
              onProblem={(problem) => setProblems((list) => [...list, problem])}
              onDataChange={setData}
            />
            </MaybePipelines>
            </PreviewAppearance>
          </div>
          {problems.length > 0 && (
            <ul className="catalog-problems" role="alert">
              {problems.map((p, i) => (
                <li key={i}>
                  {p.path ? `${p.path}: ` : ""}
                  {p.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        <SurfaceCode page={page} />

        <div className="catalog-split">
          <section className="card" aria-label="Props">
            <div className="card-head">
              <h2>Props</h2>
              <button type="button" className="btn" onClick={() => setText(JSON.stringify(exampleProps(name, source, thirds), null, 2))}>
                Reset to example
              </button>
            </div>
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
                <SchemaForm
                  schema={(schema ?? {}) as JsonSchema}
                  value={shown}
                  skip={["id", "component"]}
                  onChange={(next) => setText(JSON.stringify(next, null, 2))}
                />
              )
            ) : (
              <>
                <CodeInput language="json" label={`${name} props as JSON`} invalid={!!parsed.error} value={text} onChange={setText} />
                {parsed.error && (
                  <p className="catalog-error" role="alert">
                    Not drawn: {parsed.error}
                  </p>
                )}
              </>
            )}
          </section>

          <section className="card" aria-label="Events">
            <div className="card-head">
              <h2>Events</h2>
              {events.length > 0 && (
                <button type="button" className="btn" onClick={() => setEvents([])}>
                  Clear
                </button>
              )}
            </div>
            {Object.keys(declared).length === 0 ? (
              <p className="hint">{name} sends no events. It only shows what it is given.</p>
            ) : (
              <dl className="catalog-events">
                {Object.entries(declared).map(([trigger, event]) => (
                  <div key={trigger}>
                    <dt>{trigger}</dt>
                    <dd>
                      <Markdown inline text={event.description} />
                      {event.context && Object.keys(event.context).length > 0 && <span className="hint"> Adds {Object.keys(event.context).join(", ")}.</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <h3 className="catalog-sub">Sent to the agent</h3>
            {events.length === 0 ? (
              <p className="hint" role="status">
                Nothing yet. Use the preview's controls.
              </p>
            ) : (
              <div role="status">
                <CodeBlock bare code={JSON.stringify(events, null, 2)} language="json" label="Events sent to the agent" />
              </div>
            )}
            {data !== undefined && (
              <>
                <h3 className="catalog-sub">Data model</h3>
                <CodeBlock bare code={JSON.stringify(data, null, 2)} language="json" label="Data model" />
              </>
            )}
          </section>
        </div>

        <section className="card" aria-label="API">
          <div className="card-head">
            <h2>Props reference</h2>
            <span className="hint">Generated from the catalog's Zod schema</span>
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
              {props.map(([prop, shape]) => (
                <tr key={prop}>
                  <td>
                    <code>{prop}</code>
                    {!required.has(prop) && <span className="hint"> optional</span>}
                  </td>
                  <td>
                    <code>{typeOf(shape)}</code>
                  </td>
                  <td>
                    <Markdown inline text={shape.description ?? ""} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

      </div>
      )}
    </div>
  );
}
