import { type MessageInitShape, clone, create } from "@bufbuild/protobuf";
import { type DataSource, type Discovery, collect } from "@surfaces-ui/data";
import {
  AggregateFunction,
  AskRequestSchema,
  type AskResponse,
  AskResponseSchema,
  CertificationStatus,
  ContextFormat,
  type ContextPack,
  ContextPackSchema,
  type DataObject,
  DataObjectSchema,
  DeleteContextPackRequestSchema,
  DeleteContextPackResponseSchema,
  DescribeRequestSchema,
  DescribeResponseSchema,
  DescriptionOrigin,
  GetContextPackRequestSchema,
  GetContextPackResponseSchema,
  GetObjectRequestSchema,
  GetObjectResponseSchema,
  GetRelatedRequestSchema,
  GetRelatedResponseSchema,
  ListContextPacksResponseSchema,
  ObjectKind,
  type ObjectProfile,
  ObjectProfileSchema,
  type ObjectRef,
  ObjectRefSchema,
  type RelationSchema,
  RelationKind,
  RenderContextPackRequestSchema,
  RenderContextPackResponseSchema,
  SaveContextPackRequestSchema,
  SaveContextPackResponseSchema,
  SaveDescriptionRequestSchema,
  SaveDescriptionResponseSchema,
  SearchMode,
  SearchRequestSchema,
  SearchResponseSchema,
  SetCertificationRequestSchema,
  SetCertificationResponseSchema,
  SortDirection,
  type TableDetail,
  TableFormat,
} from "@surfaces-ui/proto";
import { DataType, type Field } from "apache-arrow";
import { type ResolvedItem, renderContext } from "./render.js";
import { KeywordIndex, cosine, tokenize } from "./text.js";

/** Turns text into vectors for search by meaning. */
export interface Embedder {
  /** Identifies the model, e.g. "all-MiniLM-L6-v2". */
  id: string;
  embed(texts: string[]): Promise<Float32Array[]>;
}

/** Generates text for descriptions and answers. */
export interface LanguageModel {
  id: string;
  complete(prompt: string, options?: { signal?: AbortSignal }): AsyncIterable<string>;
}

export interface StoredDescription {
  description: string;
  origin: DescriptionOrigin;
}

export interface StoredCertification {
  status: CertificationStatus;
  setBy: string;
  setAt: string;
  note: string;
}

/** Where context packs, accepted descriptions and certifications are kept. */
export interface DiscoveryStore {
  listPacks(): Promise<ContextPack[]>;
  getPack(id: string): Promise<ContextPack | undefined>;
  savePack(pack: ContextPack): Promise<void>;
  deletePack(id: string): Promise<void>;
  getDescriptions(): Promise<Record<string, StoredDescription>>;
  setDescription(key: string, value: StoredDescription): Promise<void>;
  getCertifications(): Promise<Record<string, StoredCertification>>;
  /** Undefined clears the mark. */
  setCertification(key: string, value: StoredCertification | undefined): Promise<void>;
}

/** Keeps everything in memory. Suitable for tests and demos. */
export function memoryDiscoveryStore(): DiscoveryStore {
  const packs = new Map<string, ContextPack>();
  const descriptions: Record<string, StoredDescription> = {};
  const certifications: Record<string, StoredCertification> = {};
  return {
    getCertifications: async () => ({ ...certifications }),
    setCertification: async (key, value) => {
      if (value) certifications[key] = value;
      else delete certifications[key];
    },
    listPacks: async () => [...packs.values()],
    getPack: async (id) => packs.get(id),
    savePack: async (pack) => void packs.set(pack.id, pack),
    deletePack: async (id) => void packs.delete(id),
    getDescriptions: async () => ({ ...descriptions }),
    setDescription: async (key, value) => void (descriptions[key] = value),
  };
}

export interface DiscoveryOptions {
  /** Where the catalog and statistics come from. */
  dataSource: DataSource;
  /** Sources to index. Defaults to every source the DataSource lists. */
  sourceIds?: string[];
  /**
   * Sources whose actual data values may be shown, profiled, embedded or put
   * in agent context. Defaults to none: only names, types, descriptions and
   * counts are used.
   */
  allowSampleValues?: string[];
  /** Enables semantic and hybrid search. Without it, search is keyword only. */
  embedder?: Embedder;
  /** Enables real descriptions and answers. Without it, both are labelled placeholders. */
  languageModel?: LanguageModel;
  store?: DiscoveryStore;
  /** Most tables indexed per source. Defaults to 500. */
  maxTables?: number;
  /**
   * Sources whose tables are indexed without counting their rows. Counting
   * reads every table once; on a warehouse that is slow and costs money.
   */
  skipRowCounts?: string[];
}

interface Doc {
  object: DataObject;
  text: string;
  /** For table docs, the column names, used to explain matches. */
  columns: string[];
}

interface Index {
  docs: Doc[];
  keyword: KeywordIndex;
  vectors?: Float32Array[];
  details: Map<string, TableDetail>;
}

/** One source's share of the index. */
type Part = Omit<Index, "keyword">;

const PLACEHOLDER = "placeholder";
const KEY_LIKE = /(^id$|_id$|_key$|_code$|_no$|^id_)/i;
const count = new Intl.NumberFormat("en-US");

const refKey = (ref: ObjectRef | undefined) =>
  [ref?.sourceId, ref?.table, ref?.column ?? ""].map((part) => (part ?? "").toLowerCase()).join("\u0000");
const tableKey = (sourceId: string, table: string, schema = "") => `${sourceId}\u0000${schema}\u0000${table}`.toLowerCase();
const sqlName = (name: string) => (/^[A-Za-z_]\w*$/.test(name) ? name : `"${name.replace(/"/g, '""')}"`);
/**
 * A query for a whole table, naming its catalog and schema when the catalog gave them, so tables in attached databases are found.
 * A schema with no catalog above it is a database (Teradata), and is named too.
 */
const baseSql = (ref: Pick<ObjectRef, "catalog" | "schema" | "table"> | undefined) =>
  `SELECT * FROM ${[ref?.catalog && ref.schema ? ref.catalog : "", ref?.schema ?? "", ref?.table ?? ""].filter(Boolean).map(sqlName).join(".")}`;

function display(value: unknown, type: DataType | undefined): string {
  if (value == null) return "";
  if (type && (DataType.isTimestamp(type) || DataType.isDate(type))) {
    const iso = new Date(Number(value)).toISOString();
    return DataType.isDate(type) ? iso.slice(0, 10) : iso.replace("T", " ").slice(0, 19);
  }
  return String(value);
}

/**
 * A reference discovery backend built on nothing but a DataSource: it reads
 * the catalog, indexes names and descriptions, computes statistics through
 * aggregate queries, infers likely joins, and stores context packs.
 *
 * It runs anywhere a DataSource does (a server, or a browser with
 * `memoryDataSource`). Production deployments can replace it with any other
 * implementation of the `Discovery` interface.
 */
export function createDiscovery(options: DiscoveryOptions): Discovery & { refresh(): void; warm(): Promise<{ objects: number }> } {
  const { dataSource, embedder, languageModel } = options;
  const store = options.store ?? memoryDiscoveryStore();
  const allowed = new Set(options.allowSampleValues ?? []);
  const maxTables = options.maxTables ?? 500;
  const uncounted = new Set(options.skipRowCounts ?? []);
  /** A table's detail by its full reference, or by name alone when the reference names no schema. */
  const detailOf = (details: Map<string, TableDetail>, ref: { sourceId: string; schema?: string; table: string }) =>
    (ref.schema ? details.get(tableKey(ref.sourceId, ref.table, ref.schema)) : undefined) ?? details.get(tableKey(ref.sourceId, ref.table));
  const embedded = new Map<string, Float32Array>();
  /**
   * Each source is indexed on its own, so a request about one source waits only for that source:
   * a large catalog elsewhere (a Teradata system can take minutes) never holds it up.
   */
  const parts = new Map<string, Promise<Part>>();
  let listing: Promise<string[]> | undefined;
  /** The last index put together from parts, reused while the same parts are current. */
  let joined: { parts: Part[]; index: Index } | undefined;

  const embed = async (texts: string[]): Promise<Float32Array[]> => {
    const missing = [...new Set(texts.filter((t) => !embedded.has(t)))];
    for (let at = 0; at < missing.length; at += 64) {
      const batch = missing.slice(at, at + 64);
      (await embedder!.embed(batch)).forEach((vector, i) => embedded.set(batch[i]!, vector));
    }
    return texts.map((t) => embedded.get(t)!);
  };

  const build = async (sourceId: string): Promise<Part> => {
    const overrides = await store.getDescriptions();
    const certified = await store.getCertifications();
    const certificationOf = (ref: ObjectRef) => {
      const found = certified[refKey(ref)];
      return found && found.status !== CertificationStatus.UNSPECIFIED ? found : undefined;
    };
    const docs: Doc[] = [];
    const details = new Map<string, TableDetail>();
    {
      // A source that cannot be reached is left out; the others are still searchable.
      const tables = await dataSource.listTables({ sourceId }).then(
        (listed) => listed.tables,
        () => [],
      );
      for (const summary of tables.slice(0, maxTables)) {
        const table = summary.ref?.table ?? "";
        const schema = summary.ref?.schema ?? "";
        // The listing's own database or schema is passed on, so two tables of one name in different ones are told apart.
        const detail = (await dataSource.describeTable({ sourceId, ref: { catalog: summary.ref?.catalog, schema, table }, includeStats: !uncounted.has(sourceId) }).catch(() => undefined))?.table;
        if (!detail) continue;
        if (schema) details.set(tableKey(sourceId, table, schema), detail);
        // By name alone, for a reference that names no schema: the first one listed.
        if (!details.has(tableKey(sourceId, table))) details.set(tableKey(sourceId, table), detail);
        const describe = (ref: ObjectRef, fallback: string) => {
          const saved = overrides[refKey(ref)];
          return saved ?? { description: fallback, origin: fallback ? DescriptionOrigin.SOURCE : DescriptionOrigin.UNSPECIFIED };
        };
        const tableRef = create(ObjectRefSchema, { sourceId, kind: ObjectKind.TABLE, catalog: summary.ref?.catalog, schema: summary.ref?.schema, table });
        const tableDescription = describe(tableRef, summary.comment);
        const columnNames = detail.columns.map((c) => c.name);
        docs.push({
          object: create(DataObjectSchema, {
            ref: tableRef,
            name: table,
            description: tableDescription.description,
            descriptionOrigin: tableDescription.origin,
            format: summary.format,
            rowCount: detail.rowCount,
            certification: certificationOf(tableRef),
          }),
          // The name is repeated so a match on it outranks a match on a column.
          text: `${table} ${table} ${tableDescription.description} ${columnNames.join(" ")}`,
          columns: columnNames,
        });
        for (const column of detail.columns) {
          const columnRef = create(ObjectRefSchema, { ...tableRef, kind: ObjectKind.COLUMN, column: column.name });
          const columnDescription = describe(columnRef, column.comment);
          docs.push({
            object: create(DataObjectSchema, {
              ref: columnRef,
              name: `${table}.${column.name}`,
              description: columnDescription.description,
              descriptionOrigin: columnDescription.origin,
              nativeType: column.nativeType,
              format: summary.format,
              certification: certificationOf(columnRef),
            }),
            text: `${column.name} ${column.name} ${columnDescription.description} ${table} ${column.nativeType}`,
            columns: [],
          });
        }
      }
    }
    // Only names, types and descriptions are embedded: never data values.
    const vectors = embedder ? await embed(docs.map((d) => `${d.object.name}: ${d.object.description}`.trim())) : undefined;
    return { docs, vectors, details };
  };

  const part = (sourceId: string): Promise<Part> => {
    const existing = parts.get(sourceId);
    if (existing) return existing;
    const started = build(sourceId).catch((error) => {
      if (parts.get(sourceId) === started) parts.delete(sourceId);
      throw error;
    });
    parts.set(sourceId, started);
    return started;
  };

  const allSources = (): Promise<string[]> => {
    if (options.sourceIds) return Promise.resolve(options.sourceIds);
    listing ??= dataSource.listSources({}).then(
      (listed) => listed.sources.map((s) => s.id),
      (error) => {
        listing = undefined;
        throw error;
      },
    );
    return listing;
  };

  /** The index over these sources (every source when none are named), waiting only for those. */
  const index = async (sourceIds: string[] = []): Promise<Index> => {
    const known = await allSources();
    const wanted = sourceIds.length === 0 ? known : known.filter((id) => sourceIds.includes(id));
    const ready = await Promise.all(wanted.map(part));
    if (joined && joined.parts.length === ready.length && joined.parts.every((p, i) => p === ready[i])) return joined.index;
    const docs = ready.flatMap((p) => p.docs);
    const details = new Map(ready.flatMap((p) => [...p.details]));
    const vectors = embedder ? ready.flatMap((p) => p.vectors ?? []) : undefined;
    const built: Index = { docs, keyword: new KeywordIndex(docs.map((d) => d.text)), vectors, details };
    joined = { parts: ready, index: built };
    return built;
  };

  /** Indexes a source again, e.g. after a description or certification changed. */
  const reindex = (sourceId: string) => {
    parts.delete(sourceId);
    joined = undefined;
  };

  const profileOf = async (ref: ObjectRef, withStats: boolean): Promise<ObjectProfile | undefined> => {
    const { docs, details } = await index([ref.sourceId]);
    const detail = detailOf(details, ref);
    const doc = docs.find((d) => refKey(d.object.ref) === refKey(ref)) ?? docs.find((d) => refKey(d.object.ref) === refKey({ ...ref, column: "" } as ObjectRef));
    if (!detail || !doc) return undefined;
    const valuesAllowed = allowed.has(ref.sourceId);
    const columnDoc = (name: string) => docs.find((d) => d.object.ref?.kind === ObjectKind.COLUMN && refKey(d.object.ref) === refKey({ ...ref, column: name } as ObjectRef));
    const columns = detail.columns.slice(0, 60).map((column) => ({
      name: column.name,
      nativeType: column.nativeType,
      description: columnDoc(column.name)?.object.description ?? "",
      descriptionOrigin: columnDoc(column.name)?.object.descriptionOrigin ?? DescriptionOrigin.UNSPECIFIED,
      distinctCount: undefined as bigint | undefined,
      distinctCountEstimated: false,
      nullCount: undefined as bigint | undefined,
      min: undefined as string | undefined,
      max: undefined as string | undefined,
      topValues: [] as { value: string; count: bigint }[],
      sampleValuesWithheld: !valuesAllowed,
    }));
    let rowCount = detail.rowCount;

    if (withStats) {
      const sql = baseSql(doc.object.ref ?? ref);
      // One aggregate query for every column: counts always, min and max only where values may be shown.
      const aggregates = [{ function: AggregateFunction.COUNT, alias: "n" }];
      columns.forEach((column, i) => {
        aggregates.push({ function: AggregateFunction.COUNT, column: column.name, alias: `c${i}` } as never);
        // An estimate is enough to tell an identifier from a category, and costs far less on a large table.
        aggregates.push({ function: AggregateFunction.APPROX_COUNT_DISTINCT, column: column.name, alias: `d${i}` } as never);
        if (valuesAllowed) {
          aggregates.push({ function: AggregateFunction.MIN, column: column.name, alias: `lo${i}` } as never);
          aggregates.push({ function: AggregateFunction.MAX, column: column.name, alias: `hi${i}` } as never);
        }
      });
      try {
        const result = await collect(dataSource.execute({ sourceId: ref.sourceId, query: { baseSql: sql, aggregates } }));
        const fields = new Map<string, Field>(result.table.schema.fields.map((f) => [f.name, f]));
        const value = (name: string) => result.table.getChild(name)?.get(0);
        const total = BigInt(value("n") ?? 0);
        rowCount = total;
        columns.forEach((column, i) => {
          column.nullCount = total - BigInt(value(`c${i}`) ?? 0);
          column.distinctCount = BigInt(value(`d${i}`) ?? 0);
          column.distinctCountEstimated = true;
          if (valuesAllowed) {
            column.min = display(value(`lo${i}`), fields.get(`lo${i}`)?.type);
            column.max = display(value(`hi${i}`), fields.get(`hi${i}`)?.type);
          }
        });
      } catch {
        // Statistics are best effort; the profile still shows names and types.
      }
      if (valuesAllowed) {
        const categorical = columns.filter((c) => c.distinctCount !== undefined && c.distinctCount > 0n && c.distinctCount <= 200n).slice(0, 12);
        await Promise.all(
          categorical.map(async (column) => {
            try {
              const result = await collect(
                dataSource.execute({
                  sourceId: ref.sourceId,
                  query: {
                    baseSql: sql,
                    groupBy: [column.name],
                    aggregates: [{ function: AggregateFunction.COUNT, alias: "n" }],
                    sorts: [{ column: "n", direction: SortDirection.DESC }],
                    page: { limit: 5 },
                  },
                }),
              );
              const type = result.table.schema.fields[0]?.type;
              const values = result.table.getChildAt(0);
              const counts = result.table.getChild("n");
              for (let row = 0; row < result.table.numRows; row++) {
                const raw = values?.get(row);
                column.topValues.push({ value: raw == null ? "(empty)" : display(raw, type), count: BigInt(counts?.get(row) ?? 0) });
              }
            } catch {
              // Skip columns the engine cannot group.
            }
          }),
        );
      }
    }

    return create(ObjectProfileSchema, {
      object: doc.object,
      columns,
      rowCount,
      sampleValuesAllowed: valuesAllowed,
      profiledAt: withStats ? new Date().toISOString() : "",
    });
  };

  const related = async (ref: ObjectRef, kinds: RelationKind[]): Promise<MessageInitShape<typeof RelationSchema>[]> => {
    const { docs, details } = await index([ref.sourceId]);
    const mine = detailOf(details, ref);
    if (!mine) return [];
    const want = (kind: RelationKind) => kinds.length === 0 || kinds.includes(kind);
    const myColumns = new Map(mine.columns.map((c) => [c.name.toLowerCase(), c]));
    const out: MessageInitShape<typeof RelationSchema>[] = [];
    for (const doc of docs) {
      const other = doc.object.ref;
      if (other?.kind !== ObjectKind.TABLE || other.sourceId !== ref.sourceId || other.table.toLowerCase() === ref.table.toLowerCase()) continue;
      const theirs = detailOf(details, other);
      if (!theirs) continue;
      const shared = theirs.columns.filter((c) => myColumns.has(c.name.toLowerCase()));
      const keys = shared.filter((c) => KEY_LIKE.test(c.name));
      // Foreign keys the source declares, either way round, are facts: reported as such, and no guess is added beside them.
      const same = (a: string | undefined, b: string) => (a ?? "").toLowerCase() === b.toLowerCase();
      const declared = [
        ...mine.foreignKeys.filter((fk) => same(fk.references?.table, other.table)).map((fk) => fk.columns.map((c, i) => ({ leftColumn: c, rightColumn: fk.referencedColumns[i] ?? c }))),
        ...theirs.foreignKeys.filter((fk) => same(fk.references?.table, ref.table)).map((fk) => fk.columns.map((c, i) => ({ leftColumn: fk.referencedColumns[i] ?? c, rightColumn: c }))),
      ];
      if (want(RelationKind.JOIN) && declared.length > 0) {
        for (const pairs of declared) {
          out.push({
            kind: RelationKind.JOIN,
            object: doc.object,
            keys: pairs,
            confidence: 1,
            reason: `Declared key: ${pairs.map((p) => (p.leftColumn === p.rightColumn ? p.leftColumn : `${p.leftColumn} = ${p.rightColumn}`)).join(", ")}`,
            inferred: false,
          });
        }
      } else if (want(RelationKind.JOIN) && keys.length > 0) {
        const leading = keys.some((k) => mine.columns[0]?.name.toLowerCase() === k.name.toLowerCase() || theirs.columns[0]?.name.toLowerCase() === k.name.toLowerCase());
        out.push({
          kind: RelationKind.JOIN,
          object: doc.object,
          keys: keys.map((k) => ({ leftColumn: myColumns.get(k.name.toLowerCase())!.name, rightColumn: k.name })),
          confidence: leading ? 0.8 : 0.6,
          reason: `Both have ${keys.map((k) => k.name).join(", ")}`,
          inferred: true,
        });
      }
      const union = new Set([...myColumns.keys(), ...theirs.columns.map((c) => c.name.toLowerCase())]).size;
      const overlap = union === 0 ? 0 : shared.length / union;
      if (want(RelationKind.SIMILAR) && overlap >= 0.6) {
        out.push({
          kind: RelationKind.SIMILAR,
          object: doc.object,
          confidence: overlap,
          reason: `Shares ${shared.length} of ${union} columns`,
          inferred: true,
        });
      }
    }
    return out.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  };

  const facts = (profile: ObjectProfile): string => {
    const object = profile.object;
    const format = TableFormat[object?.format ?? 0]?.toLowerCase();
    const size = profile.rowCount === undefined ? "" : `, ${count.format(Number(profile.rowCount))} rows`;
    return `Table ${object?.ref?.table}${format && format !== "unspecified" ? ` (${format}${size})` : size ? ` (${size.slice(2)})` : ""}`;
  };

  const metadataPrompt = (profile: ObjectProfile) =>
    [
      facts(profile),
      profile.object?.description ? `Existing description: ${profile.object.description}` : "",
      "Columns:",
      ...profile.columns.map((c) => `- ${c.name} ${c.nativeType}${c.description ? ` — ${c.description}` : ""}`),
    ]
      .filter(Boolean)
      .join("\n");

  const complete = async (prompt: string, signal?: AbortSignal) => {
    let text = "";
    for await (const delta of languageModel!.complete(prompt, { signal })) text += delta;
    return text;
  };

  const resolve = async (pack: ContextPack) => {
    const items: ResolvedItem[] = [];
    const missing: ObjectRef[] = [];
    for (const item of pack.items) {
      const ref = item.ref;
      const profile = ref ? await profileOf(ref, false) : undefined;
      if (!ref || !profile) {
        if (ref) missing.push(ref);
        continue;
      }
      const resolved: ResolvedItem = { ref, profile, columns: item.columns, note: item.note, sampleRowsWithheld: false };
      if (item.includeSampleRows) {
        if (!profile.sampleValuesAllowed) resolved.sampleRowsWithheld = true;
        else {
          try {
            const result = await collect(
              dataSource.execute({ sourceId: ref.sourceId, query: { baseSql: baseSql(profile.object?.ref ?? ref), columns: item.columns, page: { limit: 5 } } }),
            );
            const fields = result.table.schema.fields;
            resolved.sampleRows = {
              columns: fields.map((f) => f.name),
              rows: Array.from({ length: result.table.numRows }, (_, r) => fields.map((f, c) => display(result.table.getChildAt(c)?.get(r), f.type))),
            };
          } catch {
            resolved.sampleRowsWithheld = true;
          }
        }
      }
      items.push(resolved);
    }
    return { items, missing };
  };

  return {
    refresh() {
      parts.clear();
      listing = undefined;
      joined = undefined;
    },

    /**
     * Builds the search index now, so the first search does not wait for it. Sources are read one at a time;
     * a request about a source not reached yet starts that source at once.
     */
    async warm() {
      for (const sourceId of await allSources()) await part(sourceId).catch(() => undefined);
      return { objects: (await index()).docs.length };
    },

    async search(init) {
      const request = create(SearchRequestSchema, init);
      const { docs, keyword, vectors } = await index(request.sourceIds);
      const semantic = vectors !== undefined && embedder !== undefined;
      const requested = request.mode === SearchMode.UNSPECIFIED ? SearchMode.HYBRID : request.mode;
      const modeUsed = semantic ? requested : SearchMode.KEYWORD;
      const keep = (doc: Doc) =>
        (request.sourceIds.length === 0 || request.sourceIds.includes(doc.object.ref?.sourceId ?? "")) &&
        (request.kinds.length === 0 || request.kinds.includes(doc.object.ref?.kind ?? ObjectKind.UNSPECIFIED)) &&
        (request.certificationStatuses.length === 0 ||
          request.certificationStatuses.includes(doc.object.certification?.status ?? CertificationStatus.UNSPECIFIED));
      // Certified objects rise and deprecated ones sink, without hiding either.
      const standing = (doc: Doc) =>
        doc.object.certification?.status === CertificationStatus.CERTIFIED
          ? 1.25
          : doc.object.certification?.status === CertificationStatus.DEPRECATED
            ? 0.5
            : 1;
      const pageSize = request.pageSize || 20;
      const offset = Number(request.pageToken || 0);
      const page = <T,>(all: T[]) => ({ slice: all.slice(offset, offset + pageSize), next: offset + pageSize < all.length ? String(offset + pageSize) : "" });

      if (request.query.trim() === "") {
        // No query: browse tables by name.
        const all = docs.filter((d) => keep(d) && (request.kinds.length > 0 || d.object.ref?.kind === ObjectKind.TABLE));
        all.sort((a, b) => standing(b) - standing(a) || a.object.name.localeCompare(b.object.name));
        const { slice, next } = page(all);
        return create(SearchResponseSchema, { hits: slice.map((d) => ({ object: d.object, score: 0 })), nextPageToken: next, modeUsed, total: BigInt(all.length) });
      }

      const terms = tokenize(request.query);
      const byKeyword = modeUsed === SearchMode.SEMANTIC ? [] : keyword.search(request.query).filter((hit) => keep(docs[hit.index]!));
      let byMeaning: { index: number; similarity: number }[] = [];
      if (modeUsed !== SearchMode.KEYWORD) {
        const [queryVector] = await embed([request.query]);
        byMeaning = docs
          .map((doc, i) => ({ index: i, similarity: keep(doc) ? cosine(queryVector!, vectors![i]!) : -1 }))
          .filter((hit) => hit.similarity >= 0.2)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 200);
      }

      // Reciprocal rank fusion: an object ranked well by either method rises.
      const fused = new Map<number, { score: number; matched: string[]; similarity?: number }>();
      byKeyword.forEach((hit, rank) => fused.set(hit.index, { score: 1 / (60 + rank), matched: hit.matched }));
      byMeaning.forEach((hit, rank) => {
        const entry = fused.get(hit.index) ?? { score: 0, matched: [] };
        entry.score += 1 / (60 + rank);
        entry.similarity = hit.similarity;
        fused.set(hit.index, entry);
      });
      // An object whose own name matches every word asked for comes first: a search for "customer" finds the
      // customers table and its customer columns before customers.phone, which matches only through its table.
      const ownName = (doc: Doc) => {
        const leaf = tokenize(doc.object.name.slice(doc.object.name.lastIndexOf(".") + 1));
        if (terms.length === 0 || !terms.every((t) => leaf.some((n) => n.startsWith(t.replace(/s$/, ""))))) return 1;
        return doc.object.ref?.kind === ObjectKind.TABLE ? 1.6 : 1.5;
      };
      for (const [i, entry] of fused) entry.score *= standing(docs[i]!) * ownName(docs[i]!);
      const ranked = [...fused].sort((a, b) => b[1].score - a[1].score || a[0] - b[0]);
      const top = ranked[0]?.[1].score ?? 1;
      const { slice, next } = page(ranked);
      return create(SearchResponseSchema, {
        hits: slice.map(([i, entry]) => {
          const doc = docs[i]!;
          const reasons: string[] = [];
          const inName = entry.matched.filter((t) => tokenize(doc.object.name).some((n) => n.startsWith(t.replace(/s$/, ""))));
          if (inName.length > 0) reasons.push(`Name matches “${inName.join(" ")}”`);
          const inColumns = doc.columns.filter((c) => entry.matched.some((t) => tokenize(c).some((n) => n.startsWith(t.replace(/s$/, "")))));
          if (inColumns.length > 0) reasons.push(`Has column ${inColumns.slice(0, 3).join(", ")}`);
          if (entry.matched.some((t) => tokenize(doc.object.description).some((n) => n.startsWith(t.replace(/s$/, ""))))) reasons.push("Description matches");
          if (entry.similarity !== undefined && (reasons.length === 0 || entry.similarity >= 0.5)) {
            reasons.push(`Similar in meaning (${Math.round(entry.similarity * 100)}%)`);
          }
          if (reasons.length === 0 && terms.length > 0) reasons.push("Related terms match");
          return { object: doc.object, score: entry.score / top, reasons };
        }),
        nextPageToken: next,
        modeUsed,
        total: BigInt(ranked.length),
      });
    },

    async getObject(init) {
      const request = create(GetObjectRequestSchema, init);
      const profile = request.ref ? await profileOf(request.ref, request.includeProfile) : undefined;
      if (!profile) throw new Error(`Object not found: ${request.ref?.table ?? ""}`);
      return create(GetObjectResponseSchema, { profile });
    },

    async getRelated(init) {
      const request = create(GetRelatedRequestSchema, init);
      return create(GetRelatedResponseSchema, { relations: request.ref ? await related(request.ref, request.kinds) : [] });
    },

    async describe(init, callOptions) {
      const request = create(DescribeRequestSchema, init);
      const profile = request.ref ? await profileOf(request.ref, false) : undefined;
      if (!profile) throw new Error(`Object not found: ${request.ref?.table ?? ""}`);
      if (!languageModel) {
        // No model: state the facts and say so, rather than invent meaning.
        const names = profile.columns.map((c) => c.name);
        return create(DescribeResponseSchema, {
          description: `${facts(profile)} with ${names.length} columns: ${names.slice(0, 12).join(", ")}${names.length > 12 ? ", …" : ""}.`,
          generatedBy: PLACEHOLDER,
        });
      }
      const prompt = [
        "Write a short, factual description of this table for a data catalog (two sentences at most).",
        request.includeColumns ? "Also describe each column in a few words." : "",
        'Reply with JSON only: {"description": string, "columns": {name: string}}. Do not guess at meaning you cannot infer from names and types.',
        "",
        metadataPrompt(profile),
      ]
        .filter((line) => line !== "")
        .join("\n");
      const text = await complete(prompt, callOptions?.signal);
      try {
        const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as { description?: string; columns?: Record<string, string> };
        return create(DescribeResponseSchema, {
          description: String(parsed.description ?? "").trim(),
          columnDescriptions: request.includeColumns ? (parsed.columns ?? {}) : {},
          generatedBy: languageModel.id,
        });
      } catch {
        return create(DescribeResponseSchema, { description: text.trim(), generatedBy: languageModel.id });
      }
    },

    async saveDescription(init) {
      const request = create(SaveDescriptionRequestSchema, init);
      if (!request.ref) throw new Error("An object is required.");
      await store.setDescription(refKey(request.ref), {
        description: request.description.trim(),
        origin: request.origin || DescriptionOrigin.HUMAN,
      });
      reindex(request.ref.sourceId);
      const { docs } = await index([request.ref.sourceId]);
      return create(SaveDescriptionResponseSchema, { object: docs.find((d) => refKey(d.object.ref) === refKey(request.ref)) ?.object });
    },

    async setCertification(init) {
      const request = create(SetCertificationRequestSchema, init);
      if (!request.ref) throw new Error("An object is required.");
      const clearing = request.status === CertificationStatus.UNSPECIFIED;
      if (!clearing && request.setBy.trim() === "") throw new Error("Say who is certifying this.");
      const { docs: before } = await index([request.ref.sourceId]);
      if (!before.some((d) => refKey(d.object.ref) === refKey(request.ref))) throw new Error(`Object not found: ${request.ref.table}`);
      await store.setCertification(
        refKey(request.ref),
        clearing ? undefined : { status: request.status, setBy: request.setBy.trim(), setAt: new Date().toISOString(), note: request.note.trim() },
      );
      reindex(request.ref.sourceId);
      const { docs } = await index([request.ref.sourceId]);
      return create(SetCertificationResponseSchema, { object: docs.find((d) => refKey(d.object.ref) === refKey(request.ref))?.object });
    },

    async *ask(init, callOptions) {
      const request = create(AskRequestSchema, init);
      const part = (value: AskResponse["part"]) => create(AskResponseSchema, { part: value });
      const pack = request.contextPackId ? await store.getPack(request.contextPackId) : undefined;
      const inPack = pack ? new Set(pack.items.map((item) => refKey({ ...item.ref, column: "" } as ObjectRef))) : undefined;
      const found = await this.search({ query: request.question, sourceIds: request.sourceIds, kinds: [ObjectKind.TABLE], pageSize: 20 });
      const hits = found.hits.filter((hit) => !inPack || inPack.has(refKey(hit.object?.ref))).slice(0, 5);

      if (!languageModel) {
        const lead =
          hits.length === 0
            ? "No language model is connected, and nothing in the catalog matched this question."
            : "No language model is connected, so this is a search result, not an answer. These look most relevant:";
        yield part({ case: "textDelta", value: `${lead}\n` });
        for (const hit of hits) {
          yield part({ case: "textDelta", value: `\n- ${hit.object?.name}${hit.reasons[0] ? ` — ${hit.reasons[0]}` : ""}` });
        }
        for (const hit of hits) yield part({ case: "citation", value: { object: hit.object, reason: hit.reasons.join("; ") } } as AskResponse["part"]);
        yield part({ case: "done", value: { generatedBy: PLACEHOLDER, suggestedSql: "" } } as AskResponse["part"]);
        return;
      }

      const profiles = (await Promise.all(hits.map((hit) => profileOf(hit.object!.ref!, false)))).filter((p): p is ObjectProfile => p !== undefined);
      const prompt = [
        "Answer the question using only the tables below. Name the tables you rely on.",
        "If SQL would answer it, include one read-only SELECT in a ```sql block. Say so plainly if the tables cannot answer it.",
        "",
        ...profiles.map(metadataPrompt),
        "",
        `Question: ${request.question}`,
      ].join("\n");
      let answer = "";
      for await (const delta of languageModel.complete(prompt, { signal: callOptions?.signal })) {
        answer += delta;
        yield part({ case: "textDelta", value: delta });
      }
      for (const hit of hits) yield part({ case: "citation", value: { object: hit.object, reason: hit.reasons.join("; ") } } as AskResponse["part"]);
      const sql = /```sql\s*([\s\S]*?)```/i.exec(answer)?.[1]?.trim() ?? "";
      yield part({ case: "done", value: { generatedBy: languageModel.id, suggestedSql: sql } } as AskResponse["part"]);
    },

    async listContextPacks() {
      const packs = await store.listPacks();
      return create(ListContextPacksResponseSchema, {
        packs: packs
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .map((p) => ({ id: p.id, name: p.name, description: p.description, itemCount: p.items.length, version: p.version, updatedAt: p.updatedAt })),
      });
    },

    async getContextPack(init) {
      const pack = await store.getPack(create(GetContextPackRequestSchema, init).id);
      if (!pack) throw new Error("Context pack not found.");
      return create(GetContextPackResponseSchema, { pack });
    },

    async saveContextPack(init) {
      const request = create(SaveContextPackRequestSchema, init);
      if (!request.pack || request.pack.name.trim() === "") throw new Error("A context pack needs a name.");
      const pack = clone(ContextPackSchema, request.pack);
      const slug = pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pack";
      pack.id ||= `${slug}-${Math.random().toString(36).slice(2, 8)}`;
      pack.version = ((await store.getPack(pack.id))?.version ?? 0) + 1;
      pack.updatedAt = new Date().toISOString();
      await store.savePack(pack);
      return create(SaveContextPackResponseSchema, { pack });
    },

    async deleteContextPack(init) {
      await store.deletePack(create(DeleteContextPackRequestSchema, init).id);
      return create(DeleteContextPackResponseSchema, {});
    },

    async renderContextPack(init) {
      const request = create(RenderContextPackRequestSchema, init);
      const pack = request.target.case === "pack" ? request.target.value : request.target.case === "id" ? await store.getPack(request.target.value) : undefined;
      if (!pack) throw new Error("Context pack not found.");
      const { items, missing } = await resolve(pack);
      const rendered = renderContext(pack, items, request.format || ContextFormat.MARKDOWN);
      return create(RenderContextPackResponseSchema, { ...rendered, missing });
    },
  };
}
