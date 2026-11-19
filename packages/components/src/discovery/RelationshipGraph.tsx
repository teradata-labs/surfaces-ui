import type { Discovery } from "@surfaces-ui/data";
import { type DataObject, type Relation, RelationKind } from "@surfaces-ui/proto";
import { useEffect, useState } from "react";
import { type ObjectRefInit, useDiscovery } from "./shared.js";

export interface RelationshipGraphProps {
  /** The table at the centre. */
  objectRef: ObjectRefInit;
  /** Called when a related table is chosen, typically to re-centre on it. */
  onOpen?(object: DataObject): void;
  /** Most related tables drawn. Defaults to 8. */
  limit?: number;
  discovery?: Discovery;
  className?: string;
}

const WIDTH = 640;
const HEIGHT = 300;
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * A map of one table and the tables it connects to. Solid lines are joins,
 * labelled with their key; dashed lines are look-alike tables. Choosing a
 * table moves to it, so you can walk across the data.
 */
export function RelationshipGraph(props: RelationshipGraphProps) {
  const { limit = 8 } = props;
  const discovery = useDiscovery(props.discovery);
  const key = JSON.stringify(props.objectRef);
  const [relations, setRelations] = useState<Relation[] | undefined>();

  useEffect(() => {
    let current = true;
    setRelations(undefined);
    discovery
      .getRelated({ ref: props.objectRef })
      .then((response) => {
        if (!current) return;
        // One node per table: prefer the join when a table is both joinable and similar.
        const byTable = new Map<string, Relation>();
        for (const relation of response.relations) {
          const name = relation.object?.name ?? "";
          if (!byTable.has(name) || relation.kind === RelationKind.JOIN) byTable.set(name, relation);
        }
        setRelations([...byTable.values()].slice(0, limit));
      })
      .catch(() => current && setRelations([]));
    return () => {
      current = false;
    };
  }, [discovery, key, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  const centre = { x: WIDTH / 2, y: HEIGHT / 2 };
  const name = props.objectRef.table ?? "";
  if (relations === undefined) return <p className="sf-object-muted">Loading…</p>;
  if (relations.length === 0) return <p className="sf-object-muted">No related tables were found for {name}.</p>;

  const nodes = relations.map((relation, i) => {
    const angle = (2 * Math.PI * i) / relations.length - Math.PI / 2;
    return { relation, x: centre.x + Math.cos(angle) * 235, y: centre.y + Math.sin(angle) * 105 };
  });

  return (
    <figure className={["sf-graph", props.className].filter(Boolean).join(" ")}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Tables related to ${name}`}>
        {nodes.map(({ relation, x, y }) => {
          const join = relation.kind === RelationKind.JOIN;
          return (
            <g key={`edge-${relation.object?.name}`}>
              <line x1={centre.x} y1={centre.y} x2={x} y2={y} className="sf-graph-edge" data-kind={join ? "join" : "similar"} />
              <text x={(centre.x + x) / 2} y={(centre.y + y) / 2 - 5} className="sf-graph-edge-label" textAnchor="middle">
                {join ? short(relation.keys.map((k) => k.leftColumn).join(", "), 18) : "similar"}
              </text>
            </g>
          );
        })}
        <g className="sf-graph-node" data-centre>
          <rect x={centre.x - 70} y={centre.y - 17} width={140} height={34} rx={8} />
          <text x={centre.x} y={centre.y + 5} textAnchor="middle">
            {short(name, 18)}
          </text>
        </g>
        {nodes.map(({ relation, x, y }) => (
          <g
            key={relation.object?.name}
            className="sf-graph-node"
            role="button"
            tabIndex={0}
            aria-label={`${relation.object?.name}: ${relation.reason}`}
            onClick={() => relation.object && props.onOpen?.(relation.object)}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && relation.object) {
                event.preventDefault();
                props.onOpen?.(relation.object);
              }
            }}
          >
            <rect x={x - 66} y={y - 16} width={132} height={32} rx={8} />
            <text x={x} y={y + 5} textAnchor="middle">
              {short(relation.object?.name ?? "", 17)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="sf-graph-legend">
        <span data-kind="join">Join on shared key</span>
        <span data-kind="similar">Similar columns</span>
        <span>
          {relations.every((r) => r.inferred)
            ? "Relationships are inferred from names and types."
            : relations.every((r) => !r.inferred)
              ? "Joins are the source's declared keys."
              : "Joins on declared keys are facts; the rest are inferred from names and types."}
        </span>
      </figcaption>
    </figure>
  );
}
