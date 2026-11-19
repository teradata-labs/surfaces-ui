import { ItemControls, standardControls, useContextMenu } from "@surfaces-ui/components";
import { type KeyboardEvent, type MouseEvent, type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { MenuButton, MenuGroup, MenuItem } from "./Menu.js";
import { ChatIcon } from "./icons.js";
import type { ChatSessionSummary } from "./sessions.js";

export type SessionSort = "updated" | "created" | "title";
export type SessionGroup = "none" | "day" | "agent" | "source" | "tag";
/** How recent, relative to today, so a saved list never goes stale. */
export type SessionSince = "today" | "7d" | "30d" | "older";

/** Everything a person sets on the list. Plain JSON, so a host can keep it. */
export interface SessionListState {
  search?: string;
  sort?: SessionSort;
  direction?: "asc" | "desc";
  groupBy?: SessionGroup;
  agents?: string[];
  sources?: string[];
  tags?: string[];
  pinned?: boolean;
  since?: SessionSince;
}

const DAY = 86_400_000;
const startOfDay = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

/** Whether one session matches the filters and the search. */
export function sessionMatches(session: ChatSessionSummary, state: SessionListState, now = new Date()): boolean {
  const words = (state.search ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${session.title} ${session.lastMessage} ${session.tags.join(" ")}`.toLowerCase();
  if (!words.every((w) => text.includes(w))) return false;
  if (state.pinned && !session.pinned) return false;
  if (state.agents?.length && !state.agents.includes(session.agentId ?? "")) return false;
  if (state.sources?.length && !session.sources.some((s) => state.sources!.includes(s))) return false;
  if (state.tags?.length && !session.tags.some((t) => state.tags!.includes(t))) return false;
  if (state.since) {
    const at = Date.parse(session.updatedAt);
    const today = startOfDay(now);
    if (state.since === "today" && at < today) return false;
    if (state.since === "7d" && at < today - 6 * DAY) return false;
    if (state.since === "30d" && at < today - 29 * DAY) return false;
    if (state.since === "older" && at >= today - 29 * DAY) return false;
  }
  return true;
}

/** Sorted as the state says; pinned sessions come first. */
export function sortSessions(sessions: ChatSessionSummary[], state: SessionListState): ChatSessionSummary[] {
  const sort = state.sort ?? "updated";
  const flip = (state.direction ?? (sort === "title" ? "asc" : "desc")) === "desc" ? -1 : 1;
  const key = (s: ChatSessionSummary) => (sort === "title" ? s.title.toLowerCase() : sort === "created" ? s.createdAt : s.updatedAt);
  return [...sessions].sort((a, b) => Number(b.pinned) - Number(a.pinned) || flip * key(a).localeCompare(key(b)) || a.id.localeCompare(b.id));
}

/** The day a session falls in, in words. */
export function dayBucket(iso: string, now = new Date()): string {
  const at = Date.parse(iso);
  const today = startOfDay(now);
  if (at >= today) return "Today";
  if (at >= today - DAY) return "Yesterday";
  if (at >= today - 6 * DAY) return "Previous 7 days";
  if (at >= today - 29 * DAY) return "Previous 30 days";
  return "Older";
}

export interface SessionGroupOf {
  label: string;
  sessions: ChatSessionSummary[];
}

/** Filtered, sorted and grouped, as the list draws it. A session with several sources or tags is listed under each. */
export function arrangeSessions(sessions: ChatSessionSummary[], state: SessionListState, options: { now?: Date; agentName?(id: string): string } = {}): SessionGroupOf[] {
  const now = options.now ?? new Date();
  const sorted = sortSessions(
    sessions.filter((s) => sessionMatches(s, state, now)),
    state,
  );
  const by = state.groupBy ?? "none";
  if (by === "none") return sorted.length ? [{ label: "", sessions: sorted }] : [];
  const groups = new Map<string, ChatSessionSummary[]>();
  const put = (label: string, s: ChatSessionSummary) => groups.set(label, [...(groups.get(label) ?? []), s]);
  for (const s of sorted) {
    if (by === "day") put(s.pinned ? "Pinned" : dayBucket(state.sort === "created" ? s.createdAt : s.updatedAt, now), s);
    else if (by === "agent") put(s.agentId ? (options.agentName?.(s.agentId) ?? s.agentId) : "No agent named", s);
    else {
      const keys = by === "source" ? s.sources : s.tags;
      if (keys.length === 0) put(by === "source" ? "No data attached" : "No tags", s);
      for (const k of keys) put(k, s);
    }
  }
  const order = ["Pinned", "Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];
  return [...groups.entries()]
    .map(([label, list]) => ({ label, sessions: list }))
    .sort((a, b) => (by === "day" ? order.indexOf(a.label) - order.indexOf(b.label) : a.label.startsWith("No ") ? 1 : b.label.startsWith("No ") ? -1 : a.label.localeCompare(b.label)));
}

export interface SessionListProps {
  sessions: ChatSessionSummary[];
  /** The conversation open now. */
  current?: string;
  value?: SessionListState;
  defaultValue?: SessionListState;
  onChange?(state: SessionListState): void;
  onOpen(id: string): void;
  onNew?(): void;
  onRename?(id: string, title: string): void;
  onPin?(id: string, pinned: boolean): void;
  onRemove?(id: string): void;
  /** An agent's name for its id. */
  agentName?(id: string): string;
  /** With a height the rows scroll inside and only those in view are drawn. */
  height?: number;
  /** Row height for windowing, in px. Default 56. */
  rowHeight?: number;
  /** Set "now" for tests. */
  now?: Date;
  /** Shown when there are none at all. */
  empty?: ReactNode;
  /** Names the list for assistive technology. Default "Conversations". */
  label?: string;
}

type Row = { type: "group"; label: string; count: number } | { type: "session"; session: ChatSessionSummary; group: string };

const SORTS: { id: SessionSort; label: string }[] = [
  { id: "updated", label: "Last activity" },
  { id: "created", label: "Started" },
  { id: "title", label: "Title" },
];
const GROUPS: { id: SessionGroup; label: string }[] = [
  { id: "none", label: "No grouping" },
  { id: "day", label: "Day" },
  { id: "agent", label: "Agent" },
  { id: "source", label: "Data source" },
  { id: "tag", label: "Tag" },
];
const SINCE: { id: SessionSince; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "older", label: "Older than 30 days" },
];
const time = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

/**
 * Saved conversations a person can search, filter, sort and group. Each row
 * opens its conversation; rename, pin and delete are on its controls and on
 * its right-click menu, and delete asks first.
 */
export function SessionList(props: SessionListProps) {
  const { sessions, current, onOpen, onNew, onRename, onPin, onRemove, agentName, height, rowHeight = 56, now } = props;
  const [kept, setKept] = useState<SessionListState>(props.defaultValue ?? {});
  const state = props.value ?? kept;
  const set = (patch: Partial<SessionListState>) => {
    const next = { ...state, ...patch };
    for (const k of Object.keys(next) as (keyof SessionListState)[]) {
      const v = next[k];
      if (v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0)) delete next[k];
    }
    setKept(next);
    props.onChange?.(next);
  };
  const [renaming, setRenaming] = useState<{ id: string; title: string } | undefined>();
  const [confirming, setConfirming] = useState<string | undefined>();
  const [said, setSaid] = useState("");
  const menu = useContextMenu();
  const id = useId();

  const groups = useMemo(() => arrangeSessions(sessions, state, { now, agentName }), [sessions, state, now, agentName]);
  const rows: Row[] = useMemo(() => groups.flatMap((g) => [...(g.label ? [{ type: "group" as const, label: g.label, count: g.sessions.length }] : []), ...g.sessions.map((session) => ({ type: "session" as const, session, group: g.label }))]), [groups]);
  const shown = rows.filter((r) => r.type === "session").length;

  // Windowing: only rows in view are drawn when the list scrolls inside.
  const scroller = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const first = height ? Math.max(0, Math.floor(top / rowHeight) - 4) : 0;
  const last = height ? Math.min(rows.length, Math.ceil((top + height) / rowHeight) + 4) : rows.length;
  useEffect(() => {
    if (scroller.current && top > rows.length * rowHeight) scroller.current.scrollTop = 0;
  }, [rows.length, rowHeight, top]);

  const facets = useMemo(() => {
    const agents = [...new Set(sessions.flatMap((s) => (s.agentId ? [s.agentId] : [])))].sort();
    const sources = [...new Set(sessions.flatMap((s) => s.sources))].sort();
    const tags = [...new Set(sessions.flatMap((s) => s.tags))].sort();
    return { agents, sources, tags };
  }, [sessions]);
  const toggleIn = (list: string[] | undefined, value: string) => (list?.includes(value) ? list.filter((x) => x !== value) : [...(list ?? []), value]);
  const filterCount = (state.agents?.length ?? 0) + (state.sources?.length ?? 0) + (state.tags?.length ?? 0) + (state.pinned ? 1 : 0) + (state.since ? 1 : 0);

  const actions = (s: ChatSessionSummary) => ({
    rename: onRename ? () => setRenaming({ id: s.id, title: s.title }) : undefined,
    pin: onPin ? () => {
      onPin(s.id, !s.pinned);
      setSaid(s.pinned ? `Unpinned ${s.title}.` : `Pinned ${s.title}.`);
    } : undefined,
    remove: onRemove ? () => setConfirming(s.id) : undefined,
  });
  const openMenu = (event: MouseEvent<HTMLElement>, s: ChatSessionSummary) => {
    const a = actions(s);
    menu.open(event, s.title, [
      { label: "Open", onSelect: () => onOpen(s.id) },
      ...(a.rename ? [{ label: "Rename", onSelect: a.rename, hint: "F2" }] : []),
      ...(a.pin ? [{ label: s.pinned ? "Unpin" : "Pin", onSelect: a.pin, hint: "P" }] : []),
      ...(a.remove ? [{ separator: true }, { label: "Delete…", onSelect: a.remove, hint: "Delete" }] : []),
    ]);
  };
  const onRowKey = (event: KeyboardEvent<HTMLElement>, s: ChatSessionSummary) => {
    if (event.target !== event.currentTarget) return;
    const a = actions(s);
    if (event.key === "F2" && a.rename) a.rename();
    else if ((event.key === "p" || event.key === "P") && a.pin) a.pin();
    else if ((event.key === "Delete" || event.key === "Backspace") && a.remove) a.remove();
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const all = Array.from(event.currentTarget.closest(".sf-session-rows")?.querySelectorAll<HTMLElement>(".sf-session-open") ?? []);
      const at = all.indexOf(event.currentTarget as HTMLElement);
      all[at + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
    } else return;
    event.preventDefault();
  };

  const drawRow = (row: Row, index: number) => {
    if (row.type === "group")
      return (
        <li key={`g-${row.label}`} className="sf-session-group" style={height ? { height: rowHeight } : undefined} role="presentation">
          <span>{row.label}</span> <span className="sf-session-count">{row.count}</span>
        </li>
      );
    const s = row.session;
    const key = `${row.group}/${s.id}`;
    if (renaming?.id === s.id)
      return (
        <li key={key} className="sf-session" style={height ? { height: rowHeight } : undefined}>
          <form
            className="sf-session-rename"
            onSubmit={(e) => {
              e.preventDefault();
              const title = renaming.title.trim();
              if (title && title !== s.title) {
                onRename?.(s.id, title);
                setSaid(`Renamed to ${title}.`);
              }
              setRenaming(undefined);
            }}
          >
            <input
              className="sf-input"
              aria-label={`New title for ${s.title}`}
              value={renaming.title}
              // biome-ignore lint/a11y/noAutofocus: the person asked to rename this row
              autoFocus
              onChange={(e) => setRenaming({ id: s.id, title: e.target.value })}
              onKeyDown={(e) => e.key === "Escape" && setRenaming(undefined)}
            />
            <button type="submit" className="sf-button" data-variant="primary">
              Rename
            </button>
            <button type="button" className="sf-button" onClick={() => setRenaming(undefined)}>
              Cancel
            </button>
          </form>
        </li>
      );
    if (confirming === s.id)
      return (
        <li key={key} className="sf-session" data-confirm style={height ? { height: rowHeight } : undefined} role="alert">
          <span className="sf-session-confirm-text">Delete “{s.title}”? It cannot be brought back.</span>
          <button
            type="button"
            className="sf-button"
            data-variant="danger"
            // biome-ignore lint/a11y/noAutofocus: focus moves to the question the person just raised
            autoFocus
            onClick={() => {
              onRemove?.(s.id);
              setConfirming(undefined);
              setSaid(`Deleted ${s.title}.`);
            }}
          >
            Delete
          </button>
          <button type="button" className="sf-button" onClick={() => setConfirming(undefined)}>
            Keep
          </button>
        </li>
      );
    const a = actions(s);
    const meta = [s.agentId ? (agentName?.(s.agentId) ?? s.agentId) : "", s.sources.join(", "), time.format(new Date(state.sort === "created" ? s.createdAt : s.updatedAt))].filter(Boolean).join(" · ");
    return (
      <li key={key} className="sf-session sf-controls-host" data-controls="corner" data-current={s.id === current || undefined} style={height ? { height: rowHeight } : undefined}>
        <button type="button" className="sf-session-open" aria-current={s.id === current ? "true" : undefined} aria-describedby={`${id}-keys`} onClick={() => onOpen(s.id)} onContextMenu={(e) => openMenu(e, s)} onKeyDown={(e) => onRowKey(e, s)} data-index={index}>
          <span className="sf-session-title">
            {s.pinned && (
              <span className="sf-session-pin" title="Pinned">
                <ChatIcon name="pin" />
                <span className="sf-a2-visually-hidden">Pinned: </span>
              </span>
            )}
            {s.title}
          </span>
          <span className="sf-session-meta">{meta}</span>
        </button>
        {(a.rename || a.pin || a.remove) && (
          <ItemControls
            label={`${s.title} controls`}
            controls={[
              ...standardControls(s.title, { edit: a.rename }),
              ...(a.pin ? [{ id: "pin", label: s.pinned ? `Unpin ${s.title}` : `Pin ${s.title}`, icon: <ChatIcon name="pin" />, onSelect: a.pin, pressed: s.pinned }] : []),
              ...standardControls(s.title, { remove: a.remove }),
            ]}
          />
        )}
      </li>
    );
  };

  return (
    <section className="sf-sessions" aria-label={props.label ?? "Conversations"}>
      <div className="sf-sessions-bar">
        <label className="sf-sessions-search">
          <ChatIcon name="search" />
          <span className="sf-a2-visually-hidden">Search conversations</span>
          <input className="sf-input" type="search" placeholder="Search conversations" value={state.search ?? ""} onChange={(e) => set({ search: e.target.value })} />
        </label>
        {onNew && (
          <button type="button" className="sf-button" onClick={onNew}>
            <ChatIcon name="plus" /> New
          </button>
        )}
      </div>
      <div className="sf-sessions-controls">
        <MenuButton label={`Filter${filterCount ? `: ${filterCount} on` : ""}`} text={filterCount ? `Filter (${filterCount})` : "Filter"}>
          {() => (
            <>
              <MenuGroup label="Show">
                <MenuItem role="checkbox" checked={!!state.pinned} onSelect={() => set({ pinned: !state.pinned })}>
                  Pinned only
                </MenuItem>
              </MenuGroup>
              <MenuGroup label="When">
                {SINCE.map((w) => (
                  <MenuItem key={w.id} role="radio" checked={state.since === w.id} onSelect={() => set({ since: state.since === w.id ? undefined : w.id })}>
                    {w.label}
                  </MenuItem>
                ))}
              </MenuGroup>
              {facets.agents.length > 1 && (
                <MenuGroup label="Agent">
                  {facets.agents.map((a) => (
                    <MenuItem key={a} role="checkbox" checked={!!state.agents?.includes(a)} onSelect={() => set({ agents: toggleIn(state.agents, a) })}>
                      {agentName?.(a) ?? a}
                    </MenuItem>
                  ))}
                </MenuGroup>
              )}
              {facets.sources.length > 0 && (
                <MenuGroup label="Data source">
                  {facets.sources.map((a) => (
                    <MenuItem key={a} role="checkbox" checked={!!state.sources?.includes(a)} onSelect={() => set({ sources: toggleIn(state.sources, a) })}>
                      {a}
                    </MenuItem>
                  ))}
                </MenuGroup>
              )}
              {facets.tags.length > 0 && (
                <MenuGroup label="Tag">
                  {facets.tags.map((a) => (
                    <MenuItem key={a} role="checkbox" checked={!!state.tags?.includes(a)} onSelect={() => set({ tags: toggleIn(state.tags, a) })}>
                      {a}
                    </MenuItem>
                  ))}
                </MenuGroup>
              )}
              {filterCount > 0 && (
                <button type="button" className="sf-chat-menu-more" onClick={() => set({ agents: undefined, sources: undefined, tags: undefined, pinned: undefined, since: undefined })}>
                  Clear filters
                </button>
              )}
            </>
          )}
        </MenuButton>
        <MenuButton label={`Sort: ${SORTS.find((s) => s.id === (state.sort ?? "updated"))!.label}`} text={`Sort: ${SORTS.find((s) => s.id === (state.sort ?? "updated"))!.label}`}>
          {() => (
            <>
              <MenuGroup label="Sort by">
                {SORTS.map((s) => (
                  <MenuItem key={s.id} role="radio" checked={(state.sort ?? "updated") === s.id} onSelect={() => set({ sort: s.id === "updated" ? undefined : s.id, direction: undefined })}>
                    {s.label}
                  </MenuItem>
                ))}
              </MenuGroup>
              <MenuGroup label="Order">
                {(["asc", "desc"] as const).map((d) => {
                  const now = state.direction ?? ((state.sort ?? "updated") === "title" ? "asc" : "desc");
                  const words = (state.sort ?? "updated") === "title" ? { asc: "A to Z", desc: "Z to A" } : { asc: "Oldest first", desc: "Newest first" };
                  return (
                    <MenuItem key={d} role="radio" checked={now === d} onSelect={() => set({ direction: d })}>
                      {words[d]}
                    </MenuItem>
                  );
                })}
              </MenuGroup>
            </>
          )}
        </MenuButton>
        <MenuButton label={`Group: ${GROUPS.find((g) => g.id === (state.groupBy ?? "none"))!.label}`} text={`Group: ${GROUPS.find((g) => g.id === (state.groupBy ?? "none"))!.label}`}>
          {(close) => (
            <MenuGroup label="Group by">
              {GROUPS.map((g) => (
                <MenuItem
                  key={g.id}
                  role="radio"
                  checked={(state.groupBy ?? "none") === g.id}
                  onSelect={() => {
                    set({ groupBy: g.id === "none" ? undefined : g.id });
                    close();
                  }}
                >
                  {g.label}
                </MenuItem>
              ))}
            </MenuGroup>
          )}
        </MenuButton>
      </div>
      <p className="sf-sessions-status" role="status">
        {sessions.length === 0 ? "" : shown === sessions.length || state.groupBy === "source" || state.groupBy === "tag" ? `${sessions.length} conversation${sessions.length === 1 ? "" : "s"}` : `${shown} of ${sessions.length} conversations`}
        {said ? ` · ${said}` : ""}
      </p>
      <p id={`${id}-keys`} className="sf-a2-visually-hidden">
        Enter opens. {onRename ? "F2 renames. " : ""}
        {onPin ? "P pins. " : ""}
        {onRemove ? "Delete deletes, after asking. " : ""}Up and down arrows move between conversations.
      </p>
      {sessions.length === 0 ? (
        <div className="sf-sessions-empty">{props.empty ?? "No conversations yet."}</div>
      ) : rows.length === 0 ? (
        <div className="sf-sessions-empty">
          No conversations match.{" "}
          <button type="button" className="sf-button" onClick={() => set({ search: undefined, agents: undefined, sources: undefined, tags: undefined, pinned: undefined, since: undefined })}>
            Clear search and filters
          </button>
        </div>
      ) : (
        <div ref={scroller} className="sf-session-scroll" style={height ? { height, overflowY: "auto" } : undefined} onScroll={(e) => setTop(e.currentTarget.scrollTop)}>
          <ul className="sf-session-rows" style={height ? { position: "relative", height: rows.length * rowHeight } : undefined}>
            {height && first > 0 && <li aria-hidden="true" style={{ height: first * rowHeight }} className="sf-session-spacer" />}
            {rows.slice(first, last).map((row, i) => drawRow(row, first + i))}
          </ul>
        </div>
      )}
      {menu.element}
    </section>
  );
}
