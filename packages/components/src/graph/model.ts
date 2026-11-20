/** One thing on a graph. */
export interface GraphNode {
  id: string;
  label: string;
  description?: string;
  /** What kind of thing it is. Each group takes a series colour, in the order of `groups`, and is named in the legend. */
  group?: string;
  /**
   * How far along it is, shown by how full the node is drawn in its group's colour: `full`, `half` or `outline`.
   * For a level (certified, partly, not), where a different hue would say "a different thing".
   */
  level?: "full" | "half" | "outline";
}

/** A link between two nodes. Direction is not drawn. */
export interface GraphLink {
  source: string;
  target: string;
  /** What the link is, in words. */
  label?: string;
}

/** The most nodes drawn at once. Past it a person sees what is around one node, never everything at once. */
export const GRAPH_NODE_LIMIT = 300;

/** How many links each node has, by id. */
export function linkCounts(links: GraphLink[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.source, (counts.get(link.source) ?? 0) + 1);
    if (link.target !== link.source) counts.set(link.target, (counts.get(link.target) ?? 0) + 1);
  }
  return counts;
}

/** The other end of every link a node has, with what the link is. */
export function graphNeighbours(id: string, links: GraphLink[]): { id: string; label: string }[] {
  return links.flatMap((link) => (link.source === id ? [{ id: link.target, label: link.label ?? "" }] : link.target === id ? [{ id: link.source, label: link.label ?? "" }] : []));
}

/**
 * What to draw: everything when it fits; otherwise the selected node (or the most linked one) with what is within
 * two links of it, up to the limit. `hidden` is how many nodes were left out, so the screen can say so.
 */
export function graphWindow(nodes: GraphNode[], links: GraphLink[], selected: string | undefined, limit = GRAPH_NODE_LIMIT): { nodes: GraphNode[]; links: GraphLink[]; hidden: number } {
  const known = new Set(nodes.map((n) => n.id));
  const real = links.filter((l) => known.has(l.source) && known.has(l.target));
  if (nodes.length <= limit) return { nodes, links: real, hidden: 0 };
  const counts = linkCounts(real);
  const start = selected && known.has(selected) ? selected : [...nodes].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0]?.id;
  const keep = new Set<string>(start ? [start] : []);
  for (let hop = 0; hop < 2 && keep.size < limit; hop++) {
    for (const id of [...keep]) for (const next of graphNeighbours(id, real)) if (keep.size < limit) keep.add(next.id);
  }
  const shown = nodes.filter((n) => keep.has(n.id));
  return { nodes: shown, links: real.filter((l) => keep.has(l.source) && keep.has(l.target)), hidden: nodes.length - shown.length };
}

/** The groups to name in the legend: those given, in order, then any a node has that were not given. */
export function graphGroups(nodes: GraphNode[], groups: readonly string[] = []): string[] {
  const used = new Set(nodes.map((n) => n.group ?? ""));
  return [...groups.filter((g) => used.has(g)), ...[...used].filter((g) => g !== "" && !groups.includes(g))];
}

export interface GraphOptionInput {
  nodes: GraphNode[];
  links: GraphLink[];
  selected?: string;
  /** Legend order. */
  groups?: readonly string[];
  /** The theme's series colours. A group past the last colour shares it, and the graph says so. */
  colors: readonly string[];
  /** False under reduced motion: the layout is placed, not animated. */
  animate: boolean;
}

/**
 * The ECharts option for a node-link graph. Plain data, so it is tested without a canvas. A node's size follows
 * how many links it has; its colour is its group's; its fill is its level.
 */
export function buildGraphOption(input: GraphOptionInput): Record<string, unknown> {
  const { nodes, links, selected, colors, animate } = input;
  const groups = graphGroups(nodes, input.groups);
  const counts = linkCounts(links);
  const most = Math.max(1, ...nodes.map((n) => counts.get(n.id) ?? 0));
  const colorOf = (group: string | undefined) => colors[Math.min(Math.max(0, groups.indexOf(group ?? "")), Math.max(0, colors.length - 1))] ?? colors[0];
  const fill = (node: GraphNode): Record<string, unknown> => {
    const color = colorOf(node.group);
    if (node.level === "half") return { color, opacity: 0.5 };
    if (node.level === "outline") return { color: "rgba(0, 0, 0, 0)", borderColor: color, borderWidth: 2 };
    return { color };
  };
  return {
    aria: { enabled: true },
    animation: animate,
    tooltip: {
      trigger: "item",
      formatter: (item: { dataType?: string; data: { name?: string; description?: string; label?: string } }) =>
        item.dataType === "edge" ? (item.data.label ?? "") : `${item.data.name ?? ""}${item.data.description ? `: ${item.data.description}` : ""}`,
    },
    ...(groups.length > 1 ? { legend: [{ data: groups, bottom: 0 }] } : {}),
    series: [
      {
        type: "graph",
        layout: "force",
        roam: true,
        draggable: true,
        // A layout that settles and then stops, never a simulation that keeps moving.
        force: { repulsion: 220, edgeLength: 110, gravity: 0.08, layoutAnimation: animate },
        label: { show: nodes.length <= 80, position: "right" },
        emphasis: { focus: "adjacency", label: { show: true } },
        categories: groups.map((name) => ({ name, itemStyle: { color: colorOf(name) } })),
        data: nodes.map((node) => {
          const size = 14 + Math.round((22 * (counts.get(node.id) ?? 0)) / most);
          const chosen = node.id === selected;
          return {
            id: node.id,
            name: node.label,
            ...(node.description ? { description: node.description } : {}),
            ...(groups.length > 0 && node.group !== undefined ? { category: groups.indexOf(node.group) } : {}),
            symbolSize: chosen ? size + 6 : size,
            itemStyle: { ...fill(node), ...(chosen ? { borderColor: colorOf(node.group), borderWidth: 4 } : {}) },
            // A node drawn at half strength keeps its name at full strength: the fill says the level, the text must stay readable.
            ...(chosen || node.level === "half" ? { label: { ...(node.level === "half" ? { opacity: 1 } : {}), ...(chosen ? { show: true, fontWeight: "bold" } : {}) } } : {}),
          };
        }),
        links: links.map((link) => ({ source: link.source, target: link.target, ...(link.label ? { label: link.label } : {}) })),
      },
    ],
  };
}
