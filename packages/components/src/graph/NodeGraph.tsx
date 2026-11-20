import { defaultTheme, echartsTheme } from "@surfaces-ui/tokens";
import { GraphChart } from "echarts/charts";
import { AriaComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useId, useMemo, useRef } from "react";
import type { ContextNote } from "../controls/context.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";
import { GRAPH_NODE_LIMIT, type GraphLink, type GraphNode, buildGraphOption, graphGroups, graphNeighbours, graphWindow, linkCounts } from "./model.js";

echarts.use([GraphChart, TooltipComponent, LegendComponent, AriaComponent, CanvasRenderer]);

export interface NodeGraphProps {
  /** What the graph shows, for assistive technology: "Terms and how they are linked". */
  label: string;
  nodes: GraphNode[];
  links: GraphLink[];
  /** The node that is open. */
  selected?: string;
  onSelect?(id: string): void;
  /** The order groups take colours and appear in the legend. */
  groups?: readonly string[];
  /** What a level means in words, for the list: `{ full: "Certified", half: "Partly certified", outline: "Not certified" }`. */
  levels?: Partial<Record<NonNullable<GraphNode["level"]>, string>>;
  /** What the nodes are called: "term" gives "7 terms". Default "node". */
  noun?: string;
  height?: number;
  /** The most nodes drawn at once; past it the graph shows what is around the selected node. */
  limit?: number;
  /** Told what a person does here, as context for an agent. */
  onContext?(note: ContextNote): void;
}

const LEVEL_SYMBOL = { full: "●", half: "◐", outline: "○" } as const;

/**
 * Things and the links between them, drawn as a graph and listed beside it. The list does everything the canvas
 * does (find a node, open it, walk to a neighbour), so the graph is never the only way in. The layout settles and
 * stops; under reduced motion it is placed without moving. When the nodes change, those already drawn keep their
 * places and the new ones grow in, so a graph can be watched as it fills. A large graph shows what is around one node and says
 * how many it left out.
 */
export function NodeGraph({ label, nodes, links, selected, onSelect, groups, levels, noun = "node", height = 420, limit = GRAPH_NODE_LIMIT, onContext }: NodeGraphProps) {
  const theme = useOptionalTheme();
  const themeDocument = theme?.theme ?? defaultTheme;
  const mode = theme?.resolvedMode ?? "light";
  const shown = useMemo(() => graphWindow(nodes, links, selected, limit), [nodes, links, selected, limit]);
  const counts = useMemo(() => linkCounts(shown.links), [shown]);
  const legend = useMemo(() => graphGroups(shown.nodes, groups), [shown, groups]);
  const chartTheme = useMemo(() => echartsTheme(themeDocument, mode) as { color?: string[]; textStyle?: { color?: string; fontFamily?: string }; legend?: { textStyle?: { color?: string } } }, [themeDocument, mode]);
  const colors = useMemo(() => chartTheme.color ?? [], [chartTheme]);
  const text = useMemo(() => {
    const color = chartTheme.textStyle?.color;
    const muted = chartTheme.legend?.textStyle?.color;
    const fontFamily = chartTheme.textStyle?.fontFamily;
    return { ...(color ? { color } : {}), ...(muted ? { muted } : {}), ...(fontFamily ? { fontFamily } : {}) };
  }, [chartTheme]);
  const canvas = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | undefined>(undefined);
  const noteId = useId();
  const pick = useRef<(id: string) => void>(() => {});
  pick.current = (id) => {
    const node = shown.nodes.find((n) => n.id === id);
    onSelect?.(id);
    onContext?.({ kind: "node.opened", summary: `Opened ${node?.label ?? id} on the graph.`, subject: { node: id } });
  };

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let made: echarts.ECharts;
    try {
      made = echarts.init(element, echartsTheme(themeDocument, mode));
    } catch {
      // No canvas here (a test, a very old browser): the list beside it still works.
      return;
    }
    chart.current = made;
    made.on("click", (event) => {
      const id = (event.data as { id?: string } | undefined)?.id;
      if (event.dataType === "node" && id) pick.current(id);
    });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(() => made.resize());
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      made.dispose();
      chart.current = undefined;
    };
  }, [themeDocument, mode]);

  useEffect(() => {
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      // Merged into the graph that is there, so a node that was drawn keeps its place and a new one grows in beside it.
      chart.current?.setOption(buildGraphOption({ nodes: shown.nodes, links: shown.links, ...(selected ? { selected } : {}), ...(groups ? { groups } : {}), colors, text, animate: !still }), { replaceMerge: ["legend", "series"] });
    } catch {
      // Where a canvas cannot be drawn on, the list beside it is the graph.
    }
  }, [shown, selected, groups, colors, text]);

  const current = shown.nodes.find((n) => n.id === selected);
  const around = current ? graphNeighbours(current.id, shown.links) : [];
  const nameOf = (id: string) => shown.nodes.find((n) => n.id === id)?.label ?? id;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const tooMany = legend.length > colors.length && colors.length > 0;

  return (
    <section className="sf-nodegraph" aria-label={label}>
      <div className="sf-nodegraph-frame">
        <div ref={canvas} className="sf-nodegraph-canvas" style={{ height }} role="img" aria-label={`${label}: ${plural(shown.nodes.length, noun)} and ${plural(shown.links.length, "link")}, drawn as a graph.`} aria-describedby={noteId} />
        <div className="sf-nodegraph-side" style={{ maxHeight: height }}>
          <p id={noteId} className="sf-nodegraph-note" role="status">
            {plural(shown.nodes.length, noun)}, {plural(shown.links.length, "link")}, also listed here.
            {shown.hidden > 0 ? ` ${shown.hidden} more are not drawn: open one to see what is around it.` : ""}
            {tooMany ? ` There are more groups than colours, so the last ${legend.length - colors.length + 1} share one.` : ""}
          </p>
          {current && (
            <div className="sf-nodegraph-current">
              <p>
                <strong>{current.label}</strong>
                {around.length === 0 ? " has no links." : " is linked to:"}
              </p>
              {around.length > 0 && (
                <ul>
                  {around.map((other, index) => (
                    <li key={`${other.id}:${index}`}>
                      <button type="button" className="sf-button" onClick={() => pick.current(other.id)}>
                        {nameOf(other.id)}
                      </button>
                      {other.label && <span className="sf-nodegraph-kind">{other.label}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ul className="sf-nodegraph-list">
            {shown.nodes.map((node) => (
              <li key={node.id}>
                <button type="button" className="sf-nodegraph-row" aria-current={node.id === selected ? "true" : undefined} onClick={() => pick.current(node.id)}>
                  <span className="sf-nodegraph-name">{node.label}</span>
                  {node.level && (
                    <span className="sf-nodegraph-level">
                      <span aria-hidden="true">{LEVEL_SYMBOL[node.level]}</span> {levels?.[node.level] ?? ""}
                    </span>
                  )}
                  <span className="sf-nodegraph-kind">
                    {[node.group, plural(counts.get(node.id) ?? 0, "link")].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
