import type { PageDocument, SurfaceComponent } from "@surfaces-ui/spec";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { examplePages } from "../examples.js";
import { focusFor } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";
import { Devices } from "./Devices.js";
import { PERSONAS } from "./ShowcasePage.js";

/** What the person in the demo asks for, typed out before the dashboard builds. */
const PROMPT = "Build me a dashboard: the headline numbers with their trend, the breakdowns, then the rows.";
const TYPE_MS = 28;
const STEP_MS = 1100;
const HOLD_MS = 3200;

/** The leaves of a page, in reading order: the parts that appear one by one. */
function leavesOf(page: PageDocument): string[] {
  const byId = new Map(page.components.map((c) => [c.id, c]));
  const out: string[] = [];
  const walk = (id: string) => {
    const c = byId.get(id);
    if (!c) return;
    const kids = Array.isArray(c.children) ? (c.children as string[]) : typeof c.child === "string" ? [c.child] : [];
    if (kids.length === 0) out.push(id);
    else kids.forEach(walk);
  };
  walk("root");
  return out;
}

/** The page with only the given leaves, and the containers that hold any of them. */
function revealed(page: PageDocument, shown: Set<string>): PageDocument {
  const byId = new Map(page.components.map((c) => [c.id, c]));
  const keep = new Map<string, SurfaceComponent>();
  const visit = (id: string): boolean => {
    const c = byId.get(id);
    if (!c) return false;
    if (!Array.isArray(c.children)) {
      if (!shown.has(id)) return false;
      keep.set(id, c);
      return true;
    }
    const kids = (c.children as string[]).filter(visit);
    if (kids.length === 0 && id !== "root") return false;
    keep.set(id, { ...c, children: kids });
    return true;
  };
  visit("root");
  return { ...page, id: `${page.id}-${shown.size}`, components: page.components.filter((c) => keep.has(c.id)).map((c) => keep.get(c.id)!) };
}

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => globalThis.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = globalThis.matchMedia?.(query);
    if (!media) return;
    const change = () => setReduce(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduce;
}

/**
 * The demo's clock: the prompt types out, then the leaves appear one at a time, it holds, and starts again.
 * Paused, or under reduced motion, it shows the finished dashboard and stands still.
 */
function usePlayback(leaves: string[], running: boolean): { typed: number; shown: number } {
  const [tick, setTick] = useState({ typed: 0, shown: 0 });
  useEffect(() => {
    if (!running) {
      setTick({ typed: PROMPT.length, shown: leaves.length });
      return;
    }
    let typed = 0;
    let shown = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (typed < PROMPT.length) {
        typed += 1;
        timer = setTimeout(step, TYPE_MS);
      } else if (shown < leaves.length) {
        shown += 1;
        timer = setTimeout(step, STEP_MS);
      } else {
        timer = setTimeout(() => {
          typed = 0;
          shown = 0;
          setTick({ typed, shown });
          timer = setTimeout(step, 600);
        }, HOLD_MS);
        return;
      }
      setTick({ typed, shown });
    };
    timer = setTimeout(step, 400);
    return () => clearTimeout(timer);
  }, [running, leaves.length]);
  return tick;
}

export function HomePage({ source, onOpen, picker }: { source: ActiveSource; onOpen(area: string): void; picker?: ReactNode }) {
  const focus = useMemo(() => focusFor(source.sourceId, firstTable(source)), [source]);
  const page = useMemo(() => examplePages(focus)[0]!, [focus]);
  const leaves = useMemo(() => leavesOf(page), [page]);
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const { typed, shown } = usePlayback(leaves, !reduce && !paused);
  const current = useMemo(() => revealed(page, new Set(leaves.slice(0, shown))), [page, leaves, shown]);
  const prompt = PROMPT.slice(0, typed);
  const describe = `${page.title}: ${shown} of ${leaves.length} parts drawn`;

  return (
    <div className="home">
      <section className="home-hero">
        <h1 className="home-title">Surfaces UI</h1>
        <p className="home-lead">
          Components for data work that people and agents build together. Query, chart, model and share, in your own app or in a chat, on any
          engine.
        </p>
        <div className="home-actions">
          <button type="button" className="btn primary" onClick={() => onOpen("composer")}>
            Open the playground
          </button>
          <button type="button" className="btn" onClick={() => onOpen("catalog")}>
            Browse components
          </button>
          <button type="button" className="btn" onClick={() => onOpen("showcase")}>
            See the showcase
          </button>
        </div>
      </section>

      {/* The screens are the real components. Reaching into one stops the demo on the finished page, so nothing changes under the pointer. */}
      <section className="home-stage" aria-label="The playground building a dashboard, on a desktop and on a phone">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: it only watches for a person reaching into the live screens */}
        <div onPointerDown={() => setPaused(true)} onFocus={() => setPaused(true)}>
          <Devices page={current} prompt={prompt} typing={typed < PROMPT.length} describe={describe} />
        </div>
        <div className="home-stage-foot">
          {picker}
          <p className="hint" role="status">
            {reduce
              ? "Shown finished, since your system asks for less motion. Every part is live: click, filter and scroll."
              : paused
                ? `${page.title}, over the ${focus.title.toLowerCase()} sample. Every part is live: click, filter and scroll.`
                : `${page.title}, over the ${focus.title.toLowerCase()} sample. Click into it to stop and try it.`}
          </p>
          {!reduce && (
            <button type="button" className="btn" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
              {paused ? "Play" : "Pause"}
            </button>
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-showcase">
        <div className="home-section-head">
          <h2 id="home-showcase">Showcase</h2>
          <p className="hint">Setups for the people who work with data, each made from the same components.</p>
        </div>
        <ul className="home-personas">
          {PERSONAS.map((persona) => (
            <li key={persona.id}>
              <button type="button" className="home-persona" onClick={() => onOpen(`showcase?persona=${persona.id}`)}>
                <span className="home-persona-name">{persona.name}</span>
                <span className="home-persona-line">{persona.line}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
