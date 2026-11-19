import { type PageDocument, type SurfaceComponent, analyticsCatalog, toMarkup } from "@surfaces-ui/spec";
import { useEffect, useMemo, useState } from "react";
import { exampleProps } from "../catalogExamples.js";
import { examplePages } from "../examples.js";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";
import { Devices } from "./Devices.js";

export interface Persona {
  id: string;
  name: string;
  /** Who it is for, in one line. */
  line: string;
  /** What their day asks of the tools. */
  needs: string;
  /** What this person would ask for, shown above their setup. */
  prompt: string;
  /** The parts of the library the setup is made of, each with where to see it here. */
  parts: { label: string; area: string; about: string }[];
}

/**
 * Setups for the people who work with data. Each is made from the same components and services; what differs is
 * which of them a role sees first and how they are arranged. A setup names the playground areas that show it today.
 */
export const PERSONAS: Persona[] = [
  {
    id: "analyst",
    prompt: "Let me drag columns around until the answer shows.",
    name: "Analyst",
    line: "Answers questions about the business, fast, and shares what they find.",
    needs: "Explore one table without writing SQL, keep the views that matter as a report, and filter all of it at once.",
    parts: [
      { label: "Explorer", area: "pages", about: "Pills for every column; drag them onto shelves to chart and count." },
      { label: "Report builder", area: "pages", about: "Views kept as tiles, one set of filters for all of them." },
      { label: "Chat", area: "chat", about: "Ask in words; the agent draws live charts in the reply." },
    ],
  },
  {
    id: "analytics-engineer",
    prompt: "Show me how these tables join, then the measure by quarter.",
    name: "Analytics engineer",
    line: "Defines what each number means, once, for everyone.",
    needs: "Model how tables join, agree each metric's definition and grain, and version it so reports cannot drift.",
    parts: [
      { label: "Semantic models", area: "semantic", about: "Dimensions, measures and metrics, each saying who defined it, versioned." },
      { label: "Data model", area: "model", about: "Join tables by dragging columns; declared keys and guesses kept apart." },
      { label: "SQL workbench", area: "workbench", about: "Check any definition against the data." },
    ],
  },
  {
    id: "data-engineer",
    prompt: "How did last night's build go, and what failed?",
    name: "Data engineer",
    line: "Connects sources and keeps datasets built and correct.",
    needs: "Bring files and stores in, build datasets from one another, and see at once when a check fails.",
    parts: [
      { label: "Pipelines", area: "pipelines", about: "Datasets, their checks and runs, live; full refreshes confirmed first." },
      { label: "Sources", area: "sources", about: "What each source reads, how it connects, and a test per table." },
      { label: "Data model", area: "model", about: "Keys and joins across what was brought in." },
    ],
  },
  {
    id: "data-steward",
    prompt: "Which columns hold personal data, and what do we do with them?",
    name: "Data steward",
    line: "Decides what can be trusted and what is personal.",
    needs: "Find every table, certify the good ones, review personal data column by column, and approve changes step by step.",
    parts: [
      { label: "Data catalog", area: "discover", about: "Search by words or meaning, profiles, certification and related tables." },
      { label: "Patterns", area: "patterns", about: "Personal data review, cleaning plans and approvals a person decides." },
      { label: "Saved surfaces", area: "library", about: "Every page and form kept with its versions." },
    ],
  },
  {
    id: "leader",
    prompt: "How are we doing this month?",
    name: "Business leader",
    line: "Reads the numbers and asks the next question.",
    needs: "A dashboard that is right without a meeting about it, on a phone as well as a desk, with a way to ask why.",
    parts: [
      { label: "Dashboards", area: "library", about: "Headline numbers beside their trend, then the breakdowns." },
      { label: "Sample analysis", area: "analysis", about: "A conversation from question to a kept dashboard." },
      { label: "Chat", area: "chat", about: "Ask about any number in words." },
    ],
  },
  {
    id: "builder",
    prompt: "Give me that dashboard as code I can drop in my app.",
    name: "App and agent builder",
    line: "Puts all of this inside their own product or agent.",
    needs: "Plain React components, a catalog an agent can draw from, and the same surfaces in a chat, a page or an MCP host.",
    parts: [
      { label: "Playground", area: "composer", about: "Build a surface with an agent or by hand, and see its A2UI." },
      { label: "Catalog", area: "catalog", about: "Every component with its props, events and code." },
      { label: "MCP app", area: "mcp", about: "The same components inside an MCP host." },
    ],
  },
];

/** A component from the catalog with its example props, pointed at the picked data. */
function part(id: string, name: string, source: ActiveSource, extra: Record<string, unknown> = {}): SurfaceComponent {
  return { ...exampleProps(name, source), ...extra, id, component: name } as SurfaceComponent;
}

const column = (title: string, components: SurfaceComponent[]): PageDocument => ({
  catalogId: analyticsCatalog.id,
  id: `showcase-${title}`,
  title,
  components: [{ id: "root", component: "Column", children: components.map((c) => c.id) }, ...components],
});

/**
 * What a role sees first, drawn from the real components over the picked data. The desktop and the phone draw the same
 * page; it is the container that rearranges it.
 */
export function personaPage(persona: Persona, source: ActiveSource): PageDocument {
  const focus = focusFor(source.sourceId, firstTable(source));
  const dashboard = examplePages(focus)[0]!;
  const tiles = (prefix: string): SurfaceComponent[] => [
    { id: prefix, component: "Grid", columns: 2, children: [`${prefix}-metric`, `${prefix}-trend`] } as SurfaceComponent,
    part(`${prefix}-metric`, "Metric", source),
    part(`${prefix}-trend`, "Sparkline", source),
  ];
  switch (persona.id) {
    case "analyst":
      return column(persona.name, [part("explore", "Explorer", source)]);
    case "analytics-engineer":
      return column(persona.name, [part("diagram", "ModelDiagram", source, { height: 300 }), part("pivot", "PivotTable", source, { height: 220 })]);
    case "data-engineer":
      return column(persona.name, [part("graph", "PipelineGraph", source, { height: 260 }), part("runs", "RunHistory", source)]);
    case "data-steward":
      return column(persona.name, [part("pii", "PiiReview", source), part("plan", "PlanReview", source)]);
    case "leader":
      return dashboard;
    default: {
      const [grid, metric, trend] = tiles("tiles");
      const code = toMarkup([{ id: "root", component: "Grid", columns: 2, children: ["metric", "trend"] } as SurfaceComponent, { ...metric!, id: "metric" }, { ...trend!, id: "trend" }]);
      return {
        catalogId: analyticsCatalog.id,
        id: "showcase-builder",
        title: persona.name,
        components: [
          { id: "root", component: "Grid", columns: 2, children: ["live", "code"] },
          { id: "live", component: "Column", children: ["tiles", "chart"] },
          { id: "code", component: "CodeBlock", language: "tsx", code } as SurfaceComponent,
          grid!,
          metric!,
          trend!,
          part("chart", "Chart", source, { height: 220 }),
        ],
      };
    }
  }
}

const personaFromHash = () => new URLSearchParams(location.hash.split("?")[1] ?? "").get("persona") ?? PERSONAS[0]!.id;

export function ShowcasePage({ source, onOpen }: { source: ActiveSource; onOpen(area: string): void }) {
  const [id, setId] = useState(personaFromHash);
  useEffect(() => {
    const onHash = () => setId(personaFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const persona = PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
  const page = useMemo(() => personaPage(persona, source), [persona, source]);
  const choose = (next: string) => {
    setId(next);
    history.replaceState(null, "", `${location.pathname}${location.search}#showcase?persona=${next}`);
  };

  return (
    <div className="showcase">
      <div className="sf-segmented showcase-picker" data-thumb="off" role="radiogroup" aria-label="Who it is for">
        {PERSONAS.map((p) => (
          <label key={p.id} className="sf-segment" data-checked={p.id === persona.id || undefined}>
            <input type="radio" name="persona" value={p.id} checked={p.id === persona.id} onChange={() => choose(p.id)} />
            {p.name}
          </label>
        ))}
      </div>
      <section className="showcase-persona" aria-labelledby="showcase-name">
        <h2 id="showcase-name" className="showcase-name">
          {persona.name}
        </h2>
        <p className="showcase-line">{persona.line}</p>
        <p className="hint">{persona.needs}</p>
        <div className="showcase-stage" key={persona.id}>
          <Devices page={page} prompt={persona.prompt} title={`${persona.name} · Surfaces UI`} describe={`what a ${persona.name.toLowerCase()} sees first: ${persona.parts.map((p) => p.label).join(", ")}`} />
        </div>
        <h3 className="showcase-sub">Where to try it</h3>
        <ul className="showcase-parts">
          {persona.parts.map((part) => (
            <li key={part.label}>
              <button type="button" className="showcase-part" onClick={() => onOpen(part.area)}>
                <span className="showcase-part-name">{part.label}</span>
                <span className="showcase-part-about">{part.about}</span>
                <span className="showcase-part-open" aria-hidden="true">
                  Open
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
