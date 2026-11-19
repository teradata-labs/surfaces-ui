import { type ConversationDocument, MessageList, conversationDocument, conversationThread, parseConversation, scriptThread } from "@surfaces-ui/chat";
import { CodeBlock, PipelinesProvider } from "@surfaces-ui/components";
import { StaleSurfaceError, type SurfaceLibrary, surfaceKindLabel, surfaceKindOf, surfaceKinds } from "@surfaces-ui/data";
import type { SavedSurface, SurfaceSummary, SurfaceVersion } from "@surfaces-ui/proto";
import { type PageDocument, type SurfaceAction, analyticsCatalog, pageSurface, surfaceKind, validatePage } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { seeds } from "@surfaces-ui/seeds";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { examplePages } from "../examples.js";
import { focusFor } from "../focus.js";
import { composerLink, documentOf, pageOf, sourcesOf, surfaceFromHash, surfaceLink } from "../libraryLinks.js";
import type { ActiveSource } from "../source.js";

/** Every saved surface's summary, page by page. The list is the library's own metadata, not query rows. */
export async function listAll(library: SurfaceLibrary): Promise<SurfaceSummary[]> {
  const all: SurfaceSummary[] = [];
  let pageToken = "";
  for (let i = 0; i < 50; i++) {
    const response = await library.listSurfaces({ pageSize: 200, pageToken });
    all.push(...response.surfaces);
    if (!response.nextPageToken) break;
    pageToken = response.nextPageToken;
  }
  return all;
}

const SEEDED_KEY = "surfaces.playground.library.seeded";
const seeding = new WeakMap<SurfaceLibrary, Promise<number>>();

/**
 * First run: an empty library gets the example pages and every seed's
 * starters, once. A flag in this browser stops it filling the library again
 * after a person empties it on purpose.
 */
function seedLibraryOnce(source: ActiveSource): Promise<number> {
  const running = seeding.get(source.library);
  if (running) return running;
  const flag = `${SEEDED_KEY}.${source.kind}`;
  const run = (async () => {
    try {
      if (localStorage.getItem(flag)) return refreshStarters(source);
    } catch {
      // No storage: seed when empty, as below.
    }
    const existing = await source.library.listSurfaces({ pageSize: 1 });
    if (existing.surfaces.length > 0) return refreshStarters(source);
    const saved = await loadExamples(source, "Loaded on first run");
    try {
      localStorage.setItem(flag, new Date().toISOString());
    } catch {
      // Storage refused; the library is no longer empty, so this will not run again anyway.
    }
    return saved;
  })();
  seeding.set(source.library, run);
  return run;
}

const FIRST_RUN = "Playground (first run)";

/** Saves the example pages and each seed's starters that the library does not hold yet; ones already there are left as they are. */
async function loadExamples(source: ActiveSource, note: string): Promise<number> {
  const items: { page: PageDocument; kind: string; tags: string[] }[] = [
    ...examplePages(focusFor(source.sampleId, "orders")).map((page) => ({ page, kind: surfaceKind(page), tags: ["example", source.sampleId] })),
    ...seeds
      .filter((seed) => source.sources.some((s) => s.id === seed.id))
      .flatMap((seed) => seed.starters.map((starter) => ({ page: starter.page, kind: starter.kind, tags: ["starter", seed.id] }))),
  ];
  let saved = 0;
  // Written conversations ship with the seeds; each is kept as a conversation, already played.
  for (const seed of seeds.filter((s) => source.sources.some((o) => o.id === s.id))) {
    for (const script of seed.conversations ?? []) {
      try {
        await source.library.saveSurface({
          surface: {
            id: script.id,
            kind: surfaceKindOf("conversation"),
            title: script.title,
            description: script.description,
            document: conversationDocument(scriptThread(script, analyticsCatalog), { id: script.id, title: script.title, description: script.description }) as never,
            tags: ["conversation", "sample", seed.id],
            savedBy: FIRST_RUN,
            generatedBy: script.answeredBy,
          },
          expectedVersion: 0,
          note,
        });
        saved++;
      } catch {
        // Already there.
      }
    }
  }
  for (const item of items) {
    try {
      await source.library.saveSurface({
        surface: {
          id: item.page.id,
          kind: surfaceKindOf(item.kind),
          title: item.page.title,
          description: item.page.description ?? "",
          document: documentOf(item.page),
          tags: item.tags,
          savedBy: FIRST_RUN,
        },
        expectedVersion: 0,
        note,
      });
      saved++;
    } catch {
      // Already there (saved before, or by another tab): left alone.
    }
  }
  return saved;
}

/**
 * Starters loaded on first run that nobody has saved since are brought up to
 * date when the seed's starter changes (catalog pages that navigate on their
 * own, for one). A starter a person has saved again is theirs and is left alone.
 */
async function refreshStarters(source: ActiveSource): Promise<number> {
  let updated = 0;
  for (const seed of seeds.filter((s) => source.sources.some((o) => o.id === s.id))) {
    for (const starter of seed.starters) {
      try {
        const { surface } = await source.library.getSurface({ id: starter.page.id });
        if (!surface || surface.version !== 1 || surface.savedBy !== FIRST_RUN) continue;
        const document = documentOf(starter.page);
        if (JSON.stringify(surface.document) === JSON.stringify(document)) continue;
        await source.library.saveSurface({
          surface: { ...surface, title: starter.page.title, description: starter.page.description ?? "", document, savedBy: FIRST_RUN },
          expectedVersion: 1,
          note: "Starter updated",
        });
        updated++;
      } catch {
        // Missing, or saved elsewhere meanwhile: leave it.
      }
    }
  }
  return updated;
}

function errorText(error: unknown): string {
  if (error instanceof StaleSurfaceError) return `This surface was saved again since you opened it (now version ${error.latest}). Reload the library to see the latest, then try again.`;
  return error instanceof Error ? error.message : String(error);
}

const when = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

/** Pipeline components need a pipeline backend; only the dev server has one. */
export function MaybePipelines({ source, children }: { source: ActiveSource; children: ReactNode }) {
  return source.pipelines ? <PipelinesProvider pipelines={source.pipelines}>{children}</PipelinesProvider> : children;
}

/** Loads the models a page reads before it is drawn. In the browser, seeds load the first time they are used. */
export function usePrepared(source: ActiveSource, page: PageDocument | undefined): { ready: boolean; error?: string } {
  const [state, setState] = useState<{ key: string; ready: boolean; error?: string }>({ key: "", ready: false });
  const ids = useMemo(() => (page ? sourcesOf(page).filter((id) => source.sources.some((s) => s.id === id)) : []), [page, source.sources]);
  const key = ids.join(",");
  useEffect(() => {
    let current = true;
    setState({ key, ready: false });
    Promise.all(ids.map((id) => source.prepare(id)))
      .then(() => current && setState({ key, ready: true }))
      .catch((error: unknown) => current && setState({ key, ready: true, error: errorText(error) }));
    return () => {
      current = false;
    };
    // `ids` is captured by `key`.
  }, [key, source]); // eslint-disable-line react-hooks/exhaustive-deps
  return state.key === key ? state : { ready: false };
}

/** Lines of `before` and `after`, each marked as kept, removed or added. */
export function lineDiff(before: string, after: string): { kind: "same" | "remove" | "add"; text: string }[] {
  const a = before.split("\n");
  const b = after.split("\n");
  if (a.length * b.length > 4_000_000) return [...a.map((text) => ({ kind: "remove" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))];
  // Longest common subsequence, from the end, then walked from the start.
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] = a[i] === b[j] ? table[(i + 1) * width + j + 1]! + 1 : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
  const out: { kind: "same" | "remove" | "add"; text: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) out.push({ kind: "remove", text: a[i++]! });
    else out.push({ kind: "add", text: b[j++]! });
  }
  while (i < a.length) out.push({ kind: "remove", text: a[i++]! });
  while (j < b.length) out.push({ kind: "add", text: b[j++]! });
  return out;
}

/** The data a saved page reads, by the names the data picker uses. */
function readsText(page: PageDocument, source: ActiveSource): string {
  const ids = sourcesOf(page);
  if (ids.length === 0) return "No data";
  return ids.map((id) => source.sources.find((s) => s.id === id)?.label ?? id).join(", ");
}

const json = (surface: SavedSurface | undefined) => JSON.stringify(surface?.document ?? {}, null, 2);

function Versions({ source, surface }: { source: ActiveSource; surface: SavedSurface }) {
  const id = useId();
  const [versions, setVersions] = useState<SurfaceVersion[] | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  const [diff, setDiff] = useState<{ from: number; to: number; lines: ReturnType<typeof lineDiff> } | undefined>();
  const [onlyChanges, setOnlyChanges] = useState(true);

  useEffect(() => {
    let current = true;
    setVersions(undefined);
    setDiff(undefined);
    source.library
      .listSurfaceVersions({ id: surface.id })
      .then(({ versions: list }) => {
        if (!current) return;
        setVersions(list);
        setTo(list[0]?.version ?? 0);
        setFrom(list[1]?.version ?? list[0]?.version ?? 0);
      })
      .catch((e: unknown) => current && setError(errorText(e)));
    return () => {
      current = false;
    };
  }, [source.library, surface.id, surface.version]);

  const compare = async () => {
    setError(undefined);
    try {
      const [a, b] = await Promise.all([source.library.getSurface({ id: surface.id, version: from }), source.library.getSurface({ id: surface.id, version: to })]);
      setDiff({ from, to, lines: lineDiff(json(a.surface), json(b.surface)) });
    } catch (e) {
      setError(errorText(e));
    }
  };

  if (error)
    return (
      <p className="library-error" role="alert">
        {error}
      </p>
    );
  if (!versions) return <p className="hint">Loading versions…</p>;
  const added = diff?.lines.filter((l) => l.kind === "add").length ?? 0;
  const removed = diff?.lines.filter((l) => l.kind === "remove").length ?? 0;
  // With "only changes", unchanged lines more than two away from a change are left out, and each gap is marked.
  const shown: { kind: "same" | "remove" | "add" | "gap"; text: string }[] = [];
  diff?.lines.forEach((line, i, all) => {
    const near = line.kind !== "same" || [-2, -1, 1, 2].some((d) => all[i + d] && all[i + d]!.kind !== "same");
    if (!onlyChanges || near) shown.push(line);
    else if (shown.at(-1)?.kind !== "gap") shown.push({ kind: "gap", text: "…" });
  });
  return (
    <div className="library-versions">
      <table className="library-table">
        <caption className="sf-a2-visually-hidden">Versions of {surface.title}, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Version</th>
            <th scope="col">Saved</th>
            <th scope="col">By</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr key={v.version}>
              <td>{v.version}</td>
              <td>{when(v.savedAt)}</td>
              <td>{v.savedBy || "Not recorded"}</td>
              <td>{v.note || "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {versions.length < 2 ? (
        <p className="hint">There is only one version, so there is nothing to compare yet. Save the surface again, or fork it and change the copy.</p>
      ) : (
        <div className="actions">
          <label className="library-inline" htmlFor={`${id}-from`}>
            <span>Compare version</span>
          </label>
          <select id={`${id}-from`} className="sf-input" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}
              </option>
            ))}
          </select>
          <label className="library-inline" htmlFor={`${id}-to`}>
            <span>with version</span>
          </label>
          <select id={`${id}-to`} className="sf-input" value={to} onChange={(e) => setTo(Number(e.target.value))}>
            {versions.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version}
              </option>
            ))}
          </select>
          <button type="button" className="sf-button" data-variant="primary" disabled={from === to} onClick={() => void compare()}>
            Compare
          </button>
        </div>
      )}
      {diff && (
        <div className="library-diff-wrap">
          <p className="hint" role="status">
            Version {diff.from} to version {diff.to}: {added === 0 && removed === 0 ? "the documents are the same." : `${added} ${added === 1 ? "line" : "lines"} added, ${removed} removed.`}
          </p>
          <label className="library-inline">
            <input type="checkbox" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
            <span>Only changed lines and their neighbours</span>
          </label>
          <pre className="library-diff" tabIndex={0} aria-label={`Changes from version ${diff.from} to ${diff.to}`}>
            {shown.map((line, i) => (
              <span key={i} className="library-diff-line" data-change={line.kind}>
                <span className="library-diff-mark">{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}</span>
                <span className="sf-a2-visually-hidden">{line.kind === "add" ? "Added: " : line.kind === "remove" ? "Removed: " : line.kind === "gap" ? "Unchanged lines left out" : ""}</span>
                {line.kind === "gap" ? <span aria-hidden="true">{line.text}</span> : line.text}
                {"\n"}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}

type View = "preview" | "json" | "versions";

/** Every source the surfaces of a conversation read. */
function conversationSources(document: ConversationDocument): string[] {
  const found = new Set<string>();
  for (const drawn of Object.values(document.thread.surfaces)) for (const component of Object.values(drawn.components)) if (typeof component.sourceId === "string") found.add(component.sourceId);
  return [...found];
}

/** A saved conversation, drawn as its thread. The components are live; what their controls send goes nowhere, since no agent is listening. */
function ConversationPreview({ source, document, version }: { source: ActiveSource; document: ConversationDocument; version: number }) {
  const thread = useMemo(() => conversationThread(document), [document]);
  const reads = useMemo<PageDocument>(
    () => ({ id: "reads", title: "", catalogId: analyticsCatalog.id, components: conversationSources(document).map((sourceId, i) => ({ id: `s${i}`, component: "Text", text: "", sourceId })) }),
    [document],
  );
  const prepared = usePrepared(source, reads);
  const [sent, setSent] = useState<string | undefined>();
  const turns = thread.messages.filter((m) => m.role === "user").length;
  return (
    <div className="library-preview">
      <p className="hint" role="note">
        A conversation of {turns} {turns === 1 ? "turn" : "turns"}, as it was kept. Its components are live and read the data again now; nobody is answering, so a control that would tell the agent something only says so here.
      </p>
      {prepared.error && (
        <p className="library-error" role="alert">
          {prepared.error}
        </p>
      )}
      {!prepared.ready ? (
        <p className="hint">Loading the data this conversation reads…</p>
      ) : (
        <MaybePipelines source={source}>
          <div className="sf-chat library-conversation" key={`${document.id}:${version}`}>
            <MessageList thread={thread} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} onAction={(action) => setSent(action.name)} onAnswer={() => undefined} />
          </div>
        </MaybePipelines>
      )}
      {sent && (
        <p className="hint" role="status">
          A control sent “{sent}”. In a live conversation the agent would answer; here nothing else happens.
        </p>
      )}
    </div>
  );
}

function Detail({ source, surface, all, onChanged, onReload }: { source: ActiveSource; surface: SavedSurface; all: SurfaceSummary[]; onChanged(id?: string): void; onReload(): void }) {
  const [view, setView] = useState<View>("preview");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [stale, setStale] = useState(false);
  const [sent, setSent] = useState<SurfaceAction | undefined>();
  const conversation = useMemo(() => parseConversation(surface.document), [surface]);
  const page = useMemo(() => (conversation ? undefined : pageOf(surface)), [surface, conversation]);
  const issues = useMemo(() => (page ? validatePage(page, analyticsCatalog) : []), [page]);
  const prepared = usePrepared(source, page);
  const drawn = useMemo(() => (page ? pageSurface(page) : undefined), [page]);

  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    setStale(false);
    try {
      await work();
    } catch (e) {
      setStale(e instanceof StaleSurfaceError);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const fork = () =>
    act(async () => {
      if (!page) return;
      const taken = new Set(all.map((s) => s.id));
      let id = `${surface.id}-copy`;
      for (let n = 2; taken.has(id); n++) id = `${surface.id}-copy-${n}`;
      const title = `${surface.title} (copy)`;
      const { surface: copy } = await source.library.saveSurface({
        surface: { id, kind: surface.kind, title, description: surface.description, document: documentOf({ ...page, id, title }), tags: surface.tags, savedBy: "Playground user", generatedBy: surface.generatedBy },
        expectedVersion: 0,
        note: `Forked from ${surface.id}, version ${surface.version}`,
      });
      onChanged(copy?.id ?? id);
    });

  const remove = () =>
    act(async () => {
      await source.library.deleteSurface({ id: surface.id });
      setConfirming(false);
      onChanged(undefined);
    });

  return (
    <section className="card library-detail" aria-labelledby="library-detail-title">
      <div className="card-head">
        <h2 id="library-detail-title">{surface.title}</h2>
        <span className="badge">{surfaceKindLabel(surface.kind)}</span>
      </div>
      {surface.description && <p className="lede">{surface.description}</p>}
      <dl className="library-meta">
        <div>
          <dt>Version</dt>
          <dd>{surface.version}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{when(surface.updatedAt)}</dd>
        </div>
        <div>
          <dt>Saved by</dt>
          <dd>{surface.savedBy || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Generated by</dt>
          <dd>{surface.generatedBy || "Written by a person"}</dd>
        </div>
        {/* A saved surface names the data it reads; the data picked elsewhere in the playground does not change it. */}
        {page && (
          <div>
            <dt>Reads</dt>
            <dd>{readsText(page, source)}</dd>
          </div>
        )}
        <div>
          <dt>Tags</dt>
          <dd>{surface.tags.length > 0 ? surface.tags.join(", ") : "None"}</dd>
        </div>
        <div>
          <dt>Link</dt>
          <dd>
            <a href={surfaceLink(surface.id)}>{surface.id}</a>
          </dd>
        </div>
      </dl>

      <div className="actions">
        {conversation ? (
          <a className="sf-button" href="#analysis">
            Open sample analysis
          </a>
        ) : (
          <a className="sf-button" href={composerLink(surface.id)}>
            Open in playground
          </a>
        )}
        <button type="button" className="sf-button" disabled={busy || !page} onClick={() => void fork()}>
          Fork
        </button>
        <button type="button" className="sf-button" data-variant="danger" disabled={busy} aria-expanded={confirming} onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>
      {confirming && (
        <div className="library-confirm" role="alertdialog" aria-labelledby="library-confirm-text">
          <p id="library-confirm-text">
            Delete “{surface.title}” and all {surface.version === 1 ? "of its one version" : `its kept versions`}? This cannot be undone from here.
          </p>
          <div className="actions">
            <button type="button" className="sf-button" data-variant="danger" disabled={busy} onClick={() => void remove()}>
              Delete it
            </button>
            <button type="button" className="sf-button" autoFocus onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      {error && (
        <div className="library-error" role="alert">
          <p>{error}</p>
          {stale && (
            <button type="button" className="sf-button" onClick={onReload}>
              Reload the library
            </button>
          )}
        </div>
      )}

      <div className="sf-segmented sf-result-views" role="group" aria-label="Show">
        {(
          [
            ["preview", "Preview"],
            ["json", "JSON"],
            ["versions", "Versions"],
          ] as [View, string][]
        ).map(([value, label]) => (
          <button key={value} type="button" className="sf-segment" aria-pressed={view === value} data-checked={view === value || undefined} onClick={() => setView(value)}>
            {label}
          </button>
        ))}
      </div>

      {view === "preview" && conversation && <ConversationPreview source={source} document={conversation} version={surface.version} />}
      {view === "preview" &&
        !conversation &&
        (!page || !drawn ? (
          <p className="library-error" role="alert">
            This saved surface does not hold a page document, so it cannot be drawn. Its JSON is under JSON.
          </p>
        ) : (
          <div className="library-preview">
            {issues.length > 0 && (
              <p className="hint" role="note">
                The catalog found {issues.length} {issues.length === 1 ? "problem" : "problems"} in this page; each is shown as a notice where it would be drawn.
              </p>
            )}
            {prepared.error && (
              <p className="library-error" role="alert">
                {prepared.error}
              </p>
            )}
            {!prepared.ready ? (
              <p className="hint">Loading the data this surface reads…</p>
            ) : (
              <MaybePipelines source={source}>
                <SurfaceView key={`${surface.id}:${surface.version}`} surface={drawn} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} onAction={setSent} />
              </MaybePipelines>
            )}
            {sent && (
              <p className="hint" role="status">
                A control sent “{sent.name}”{typeof sent.context.table === "string" && sent.context.table ? ` for ${sent.context.table}` : ""}. Whatever the surface binds to its own data has changed already; in a chat the event would also go to the agent, and here nothing else acts on it.
              </p>
            )}
          </div>
        ))}
      {view === "json" && <CodeBlock code={json(surface)} language="json" label={`${surface.title} as JSON`} />}
      {view === "versions" && <Versions source={source} surface={surface} />}
    </section>
  );
}

/** Saved surfaces: listed by kind and tag, drawn, forked, compared across versions and deleted. */
export function LibraryPage({ source }: { source: ActiveSource }) {
  const id = useId();
  const [all, setAll] = useState<SurfaceSummary[] | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<string>("all");
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<string | undefined>(() => surfaceFromHash());
  const [detail, setDetail] = useState<{ surface?: SavedSurface; error?: string } | undefined>();
  const [reloads, setReloads] = useState(0);
  const [loadingExamples, setLoadingExamples] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(undefined);
    try {
      setAll(await listAll(source.library));
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [source.library]);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const loaded = await seedLibraryOnce(source);
        if (current && loaded > 0) setNotice(`Loaded ${loaded} examples: the example pages and each seed's starters.`);
      } catch (e) {
        if (current) setNotice(`Could not load the examples: ${errorText(e)}`);
      }
      if (current) await refresh();
    })();
    return () => {
      current = false;
    };
  }, [source, refresh]);

  // The address names the open surface, so a surface can be linked.
  useEffect(() => {
    const onHash = () => setSelected(surfaceFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const select = (next: string | undefined) => {
    setSelected(next);
    history.replaceState(null, "", `${location.pathname}${location.search}${next ? surfaceLink(next) : "#library"}`);
  };

  useEffect(() => {
    if (!selected) {
      setDetail(undefined);
      return;
    }
    let current = true;
    setDetail(undefined);
    source.library
      .getSurface({ id: selected })
      .then(({ surface }) => current && setDetail({ surface }))
      .catch((e: unknown) => current && setDetail({ error: errorText(e) }));
    return () => {
      current = false;
    };
  }, [selected, source.library, reloads]);

  const tags = useMemo(() => [...new Set((all ?? []).flatMap((s) => s.tags))].sort(), [all]);
  const words = text.trim().toLowerCase();
  const shown = useMemo(
    () =>
      (all ?? []).filter(
        (s) =>
          (kind === "all" || surfaceKindOf(kind) === s.kind) &&
          (!tag || s.tags.includes(tag)) &&
          (!words || [s.title, s.description, s.id, ...s.tags].some((field) => field.toLowerCase().includes(words))),
      ),
    [all, kind, tag, words],
  );
  const counts = useMemo(() => new Map(surfaceKinds.map((k) => [k.word, (all ?? []).filter((s) => s.kind === k.kind).length])), [all]);

  const reload = () => {
    setReloads((n) => n + 1);
    void refresh();
  };

  return (
    <div className="library-wrap">
      {notice && (
        <p className="library-notice" role="status">
          {notice}
        </p>
      )}
      <div className="library">
        <aside className="card library-list" aria-label="Saved surfaces">
          <div className="card-head">
            <h2>Saved surfaces</h2>
            <span className="badge">{source.kind === "server" ? "Files on the dev server" : "This browser's storage"}</span>
          </div>
          <label className="library-field">
            <span>Filter</span>
            <input className="sf-input" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Title, description or tag" />
          </label>
          <div className="library-chips" role="group" aria-label="Kind">
            <button type="button" className="sf-button" aria-pressed={kind === "all"} onClick={() => setKind("all")}>
              All ({all?.length ?? 0})
            </button>
            {surfaceKinds
              .filter((k) => (counts.get(k.word) ?? 0) > 0)
              .map((k) => (
                <button key={k.word} type="button" className="sf-button" aria-pressed={kind === k.word} onClick={() => setKind(kind === k.word ? "all" : k.word)}>
                  {k.label} ({counts.get(k.word)})
                </button>
              ))}
          </div>
          <label className="library-field" htmlFor={`${id}-tag`}>
            <span>Tag</span>
          </label>
          <select id={`${id}-tag`} className="sf-input" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {loadError && (
            <div className="library-error" role="alert">
              <p>{loadError}</p>
              <button type="button" className="sf-button" onClick={reload}>
                Try again
              </button>
            </div>
          )}
          {!all && !loadError && <p className="hint">Loading the library…</p>}
          {all && shown.length === 0 && <p className="hint">{all.length === 0 ? "The library is empty. Save a page from Pages, the workbench or the catalog." : "Nothing matches these filters."}</p>}
          <button
            type="button"
            className="sf-button"
            disabled={loadingExamples}
            onClick={async () => {
              setLoadingExamples(true);
              try {
                const added = await loadExamples(source, "Loaded from the library");
                setNotice(added === 0 ? "Every example page and seed starter is already in the library." : `Added ${added} example pages and seed starters that were missing. Surfaces already here were left as they are.`);
                await refresh();
              } catch (e) {
                setNotice(`Could not load the examples: ${errorText(e)}`);
              } finally {
                setLoadingExamples(false);
              }
            }}
          >
            Load examples and starters
          </button>
          <p className="sf-a2-visually-hidden" role="status">
            {all ? `${shown.length} of ${all.length} surfaces shown` : ""}
          </p>
          {/* The items scroll inside the list, which is as tall as the window allows, so the filters stay in view. */}
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is focusable so the keyboard can scroll it. */}
          <div className="library-items" tabIndex={0} role="region" aria-label="Saved surfaces list">
          {surfaceKinds
            .map((k) => ({ ...k, items: shown.filter((s) => s.kind === k.kind) }))
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.word} className="library-group">
                <h3>{group.label}</h3>
                <ul>
                  {group.items.map((s) => (
                    <li key={s.id}>
                      <button type="button" aria-current={s.id === selected ? "true" : undefined} onClick={() => select(s.id)}>
                        <span className="library-item-title">{s.title}</span>
                        <span className="library-item-meta">
                          {surfaceKindLabel(s.kind)} · version {s.version} · {when(s.updatedAt)}
                          {s.tags.length > 0 ? ` · ${s.tags.join(", ")}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is focusable so the keyboard can scroll it. */}
        <div className="library-main" tabIndex={0} role="region" aria-label="Open surface">
          {!selected ? (
            <section className="card">
              <p className="hint">Pick a surface to draw it, read its JSON, compare its versions, fork it or open it in the composer.</p>
            </section>
          ) : detail?.error ? (
            <section className="card">
              <p className="library-error" role="alert">
                {detail.error}
              </p>
              <button type="button" className="sf-button" onClick={() => select(undefined)}>
                Back to the list
              </button>
            </section>
          ) : !detail?.surface ? (
            <section className="card">
              <p className="hint">Loading…</p>
            </section>
          ) : (
            <Detail
              key={`${detail.surface.id}:${detail.surface.version}`}
              source={source}
              surface={detail.surface}
              all={all ?? []}
              onReload={reload}
              onChanged={(next) => {
                void refresh();
                select(next);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
