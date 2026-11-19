import { type Pill, emptyModel, piiHints, pillsFromModel } from "@surfaces-ui/components";
import { type DataSource, draftSemanticFields, typeFamily } from "@surfaces-ui/data";
import type { TableDetail } from "@surfaces-ui/proto";

/**
 * What the scripted demo proposes when asked for a semantic model: the table
 * that declares the most foreign keys, the one with the most to measure among
 * equals (the table whose rows are counted), the
 * tables those keys point at, joined on them, its declared key and a grain
 * from its name, and fields drafted from the columns' names and types. A
 * script's guess from the catalog, never values, for a person to correct.
 */
export async function scriptedModelProposal(dataSource: Pick<DataSource, "listTables" | "describeTable">, sourceId: string, by: string) {
  const { tables } = await dataSource.listTables({ sourceId, pageSize: 40 });
  const details = (await Promise.all(tables.map((t) => dataSource.describeTable({ sourceId, ref: { table: t.ref?.table ?? "" } }).then((r) => r.table)))).filter((t): t is TableDetail => !!t);
  const nameOf = (t: TableDetail) => t.summary?.ref?.table ?? "";
  // Most foreign keys first; among equals, the most numbers that are not keys, as a fact table holds what is measured.
  const measurable = (t: TableDetail) => t.columns.filter((c) => typeFamily(c) === "number" && !/(^id$|_id$|_key$|_no$|_number$|code$)/i.test(c.name)).length;
  const fact = [...details].sort((a, b) => b.foreignKeys.length - a.foreignKeys.length || measurable(b) - measurable(a))[0];
  if (!fact) return undefined;
  const joined = fact.foreignKeys.filter((fk) => details.some((d) => nameOf(d) === fk.references?.table)).slice(0, 3);
  const others = joined.map((fk) => details.find((d) => nameOf(d) === fk.references?.table)!);
  const factName = nameOf(fact);
  const keyColumns = new Set(joined.flatMap((fk) => fk.referencedColumns));
  // The joined tables' keys repeat the first table's, and a name a later table repeats comes back renamed by the engine: neither is drafted.
  const seen = new Set<string>();
  const columns = [fact, ...others].flatMap((t, i) =>
    t.columns
      .filter((c) => (i === 0 || !keyColumns.has(c.name)) && !seen.has(c.name) && (seen.add(c.name), true))
      .map((c) => ({ name: c.name, type: c.nativeType || c.arrowType, description: c.comment })),
  );
  const personal = new Set(piiHints(columns.map((c) => c.name)).map((h) => h.column));
  const fields = draftSemanticFields(
    columns.map((c) => ({ ...c, personal: personal.has(c.name) })),
    { definedBy: by },
  );
  const add: Pill[] = pillsFromModel(emptyModel({ name: "draft", ...fields })).map(({ model: _, ...pill }) => ({ ...pill, by }));
  const primaryKey = fact.columns.filter((c) => c.primaryKey).map((c) => c.name);
  const words = factName.replace(/_/g, " ");
  return {
    name: factName.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    label: words.replace(/^\w/, (c) => c.toUpperCase()),
    description: fact.summary?.comment ?? "",
    rows: {
      grain: `One ${words.replace(/s$/, "")} row.`,
      primaryKey,
      tables: [factName, ...others.map(nameOf)],
      joins: joined.map((fk) => ({ left: factName, right: fk.references?.table ?? "", type: "left" as const, keys: fk.columns.map((c, i) => ({ leftColumn: c, rightColumn: fk.referencedColumns[i] ?? c })) })),
    },
    add,
    personal: [...personal],
  };
}
