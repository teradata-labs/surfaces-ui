import type { DataSource } from "@surfaces-ui/data";
import { DENSITY_SCALE } from "@surfaces-ui/tokens";
import { type ChangeEvent, type DragEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OnContext } from "../controls/context.js";
import { useDataSource } from "../data/DataSourceProvider.js";
import { type MenuItem, copyText, useContextMenu } from "../menu/ContextMenu.js";
import { type DataRef, writeDataRefs } from "../schema/refs.js";
import { useOptionalTheme } from "../theme/ThemeProvider.js";
import { type FileItem, type FileListing, type FilePlace, fileRef, fileSize, hasDirectoryPicker, localFilesPlace, pickDirectory, sourceFiles } from "./files.js";

export interface FileBrowserProps {
  /** List this source's storage, through the backend (`DataSource.listFiles`). */
  sourceId?: string;
  /** Name shown for the source's storage. Defaults to the source id. */
  sourceLabel?: string;
  dataSource?: DataSource;
  /** Other places to list: a consumer's own store, or folders opened elsewhere. */
  places?: FilePlace[];
  /** Offer "Open a folder on this computer". The folder is read by the browser and nothing is uploaded. */
  local?: boolean;
  /** Told when a person opens a local folder, so a host can keep it. */
  onPlaceAdded?(place: FilePlace): void;
  onSelect?(item: FileItem, place: FilePlace): void;
  /** Enter or a double click on a file: open it, load it, preview it. The host decides. */
  onOpen?(item: FileItem, place: FilePlace): void;
  /** Hand files and folders to something else (a chat): the selection, or the one row. Names only. */
  onAttach?(refs: DataRef[], items: FileItem[]): void;
  /** What `onAttach` is called in the menu. Defaults to "Add to chat". */
  attachLabel?: string;
  /** Told what a person does here (a folder opened from their computer, a file opened, files handed on), by name only, for an agent's context. */
  onContext?: OnContext;
  /** Buttons at the end of a file's row. */
  renderActions?(item: FileItem, place: FilePlace): ReactNode;
  /** Height of the whole browser in px. Defaults to 420. */
  height?: number;
  /** Accessible name of the tree. */
  label?: string;
  className?: string;
}

type Loaded = FileListing & { more?: boolean };
type Children = Record<string, Loaded | "loading" | { error: string }>;

interface Node {
  id: string;
  kind: "place" | "folder" | "file" | "more" | "note";
  level: number;
  label: string;
  place: FilePlace;
  /** The folder this row lists when opened: "" for a place. */
  path: string;
  item?: FileItem;
  meta?: string;
  tag?: string;
  error?: boolean;
}

const idOf = (place: FilePlace, path: string) => `${place.id}\u0000${path}`;
const when = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");

/**
 * A tree of folders and files: a source's storage (the places it is allowed
 * to read), folders a person opens from their own computer, or both. Files
 * show their size, date and what they can be read as, and which configured
 * table reads them. Several can be selected and handed to a chat or dragged
 * onto one, as names: the browser never reads what a file holds.
 */
export function FileBrowser(props: FileBrowserProps) {
  const dataSource = useDataSource(props.dataSource);
  const theme = useOptionalTheme();
  const rowHeight = DENSITY_SCALE[theme?.theme.density ?? "comfortable"].rowHeight - 4;
  const height = props.height ?? 420;
  const menu = useContextMenu();

  const storage = useMemo(() => (props.sourceId ? sourceFiles(dataSource, props.sourceId, props.sourceLabel ?? props.sourceId) : undefined), [dataSource, props.sourceId, props.sourceLabel]);
  const [opened, setOpened] = useState<FilePlace[]>([]);
  const places = useMemo(() => [...(storage ? [storage] : []), ...(props.places ?? []), ...opened], [storage, props.places, opened]);

  const [children, setChildren] = useState<Children>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const anchor = useRef(0);
  const [note, setNote] = useState("");
  const [scrollTop, setScrollTop] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback((place: FilePlace, path: string, page?: string) => {
    const id = idOf(place, path);
    setChildren((now) => (page ? now : { ...now, [id]: "loading" }));
    place
      .list(path, page)
      .then((listing) =>
        setChildren((now) => {
          const before = now[id];
          const earlier = page && before && before !== "loading" && !("error" in before) ? before.items : [];
          return { ...now, [id]: { ...listing, items: [...earlier, ...listing.items] } };
        }),
      )
      .catch((error: unknown) => setChildren((now) => ({ ...now, [id]: { error: error instanceof Error ? error.message.replace(/^\[[a-z_]+\]\s*/i, "") : String(error) } })));
  }, []);

  // Each place opens on its top level as it appears.
  useEffect(() => {
    for (const place of places) {
      const id = idOf(place, "");
      if (children[id] === undefined) {
        load(place, "");
        setExpanded((now) => new Set(now).add(id));
      }
    }
  }, [places, children, load]);

  const nodes = useMemo(() => {
    const out: Node[] = [];
    const walk = (place: FilePlace, path: string, level: number) => {
      const state = children[idOf(place, path)];
      if (state === undefined || state === "loading") return void out.push({ id: `${idOf(place, path)}\u0000loading`, kind: "note", level, label: "Loading…", place, path });
      // A source with nothing to list (a warehouse has tables, not files) is a fact about it, not a failure.
      if ("error" in state) return void out.push({ id: `${idOf(place, path)}\u0000error`, kind: "note", level, label: state.error, place, path, error: !/no storage to list/i.test(state.error) });
      if (state.items.length === 0) out.push({ id: `${idOf(place, path)}\u0000empty`, kind: "note", level, label: "Nothing here.", place, path });
      for (const item of state.items) {
        const id = idOf(place, item.path);
        out.push({
          id,
          kind: item.kind,
          level,
          label: item.name,
          place,
          path: item.path,
          item,
          meta: item.kind === "file" ? [fileSize(item.size), when(item.modified)].filter(Boolean).join(" · ") : undefined,
          tag: item.table ? `table ${item.table}` : item.format,
        });
        if (item.kind === "folder" && expanded.has(id)) walk(place, item.path, level + 1);
      }
      if (state.next) out.push({ id: `${idOf(place, path)}\u0000more`, kind: "more", level, label: "Show more", place, path });
      else if (state.truncated) out.push({ id: `${idOf(place, path)}\u0000cut`, kind: "note", level, label: "This folder is too large to list whole; the rest is not shown.", place, path });
    };
    for (const place of places) {
      const id = idOf(place, "");
      out.push({ id, kind: "place", level: 1, label: place.label, place, path: "", tag: place.origin === "local" ? "this computer" : "storage" });
      if (expanded.has(id)) walk(place, "", 2);
    }
    return out;
  }, [places, children, expanded]);

  const toggle = (node: Node) => {
    if (node.kind === "more") {
      const state = children[idOf(node.place, node.path)];
      if (state && state !== "loading" && !("error" in state) && state.next) load(node.place, node.path, state.next);
      return;
    }
    if (node.kind !== "place" && node.kind !== "folder") return;
    const next = new Set(expanded);
    if (next.has(node.id)) next.delete(node.id);
    else {
      next.add(node.id);
      if (children[node.id] === undefined || (typeof children[node.id] === "object" && "error" in (children[node.id] as object))) load(node.place, node.path);
    }
    setExpanded(next);
  };

  /** What an action applies to: the selection when the row is part of it, the row otherwise. */
  const chosen = (node: Node): Node[] => {
    const selection = nodes.filter((n) => picked.has(n.id) && n.item);
    return selection.length > 0 && picked.has(node.id) ? selection : node.item ? [node] : [];
  };
  const refsOf = (list: Node[]) => list.map((n) => fileRef(n.place, n.item!));
  const attach = (node: Node) => {
    const list = chosen(node);
    if (list.length === 0 || !props.onAttach) return;
    props.onAttach(refsOf(list), list.map((n) => n.item!));
    setNote(`${list.length === 1 ? list[0]!.label : `${list.length} items`} added.`);
    props.onContext?.({ kind: "files.attached", summary: `Attached ${list.length === 1 ? list[0]!.path : `${list.length} files and folders`}.`, subject: { files: list.map((n) => ({ place: n.place.id, path: n.path, kind: n.kind })) } });
  };
  const pick = (index: number, how: "toggle" | "range") => {
    const node = nodes[index];
    if (!node?.item) return;
    const next = new Set(how === "range" ? [] : picked);
    if (how === "range") {
      const [from, to] = [Math.min(anchor.current, index), Math.max(anchor.current, index)];
      for (let i = from; i <= to; i++) if (nodes[i]?.item) next.add(nodes[i]!.id);
    } else {
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      anchor.current = index;
    }
    setPicked(next);
    setActive(index);
    setNote(next.size > 0 ? `${next.size} selected. Shift+Enter ${props.onAttach ? "adds them" : "does nothing here"}; Escape clears.` : "");
  };
  const open = (node: Node) => {
    if (node.kind === "file" && node.item) {
      props.onOpen?.(node.item, node.place);
      props.onContext?.({ kind: "file.opened", summary: `Opened ${node.path}${node.place.origin === "local" ? " (on their own computer)" : ""}.`, subject: { place: node.place.id, path: node.path, format: node.item.format ?? "", table: node.item.table ?? "" } });
    } else toggle(node);
  };

  const menuFor = (node: Node): MenuItem[] => {
    const many = chosen(node).length;
    return [
      ...(node.kind === "folder" ? [{ label: expanded.has(node.id) ? "Close folder" : "Open folder", onSelect: () => toggle(node), hint: "Enter" }] : []),
      ...(node.kind === "file" && props.onOpen ? [{ label: "Open", onSelect: () => open(node), hint: "Enter" }] : []),
      ...(props.onAttach ? [{ label: many > 1 ? `${props.attachLabel ?? "Add to chat"}: ${many} items` : (props.attachLabel ?? "Add to chat"), onSelect: () => attach(node), hint: "Shift+Enter" }] : []),
      { label: picked.has(node.id) ? "Remove from selection" : "Select", onSelect: () => pick(nodes.indexOf(node), "toggle"), hint: "Space" },
      { separator: true },
      {
        label: "Copy path",
        hint: "Ctrl+C",
        onSelect: () => void copyText(node.path).then((ok) => setNote(ok ? "Path copied." : "The path could not be copied.")),
      },
    ];
  };

  const reveal = (index: number) => {
    const clamped = Math.max(0, Math.min(nodes.length - 1, index));
    setActive(clamped);
    const element = list.current;
    if (!element) return;
    if (clamped * rowHeight < element.scrollTop) element.scrollTop = clamped * rowHeight;
    else if ((clamped + 1) * rowHeight > element.scrollTop + element.clientHeight) element.scrollTop = (clamped + 1) * rowHeight - element.clientHeight;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const node = nodes[active];
    if (!node) return;
    const opens = node.kind === "place" || node.kind === "folder";
    switch (event.key) {
      case "ArrowDown":
        reveal(active + 1);
        break;
      case "ArrowUp":
        reveal(active - 1);
        break;
      case "Home":
        reveal(0);
        break;
      case "End":
        reveal(nodes.length - 1);
        break;
      case "ArrowRight":
        if (opens && !expanded.has(node.id)) toggle(node);
        else if (opens) reveal(active + 1);
        break;
      case "ArrowLeft":
        if (opens && expanded.has(node.id)) toggle(node);
        else {
          // To the folder this row is in.
          for (let i = active - 1; i >= 0; i--) if (nodes[i]!.level < node.level) return void (event.preventDefault(), reveal(i));
        }
        break;
      case "Enter":
        if (event.shiftKey) attach(node);
        else open(node);
        break;
      case " ":
        pick(active, "toggle");
        break;
      case "Escape":
        if (picked.size === 0) return;
        setPicked(new Set());
        setNote("");
        break;
      case "c":
        if (!(event.ctrlKey || event.metaKey) || !node.item) return;
        void copyText(node.path).then((ok) => setNote(ok ? "Path copied." : "The path could not be copied."));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const add = (place: FilePlace) => {
    setOpened((now) => [...now.filter((p) => p.id !== place.id), place]);
    // The same folder opened again is read again.
    setChildren((now) => Object.fromEntries(Object.entries(now).filter(([id]) => !id.startsWith(`${place.id}\u0000`))));
    props.onPlaceAdded?.(place);
    setNote(`Opened ${place.label}. It is read by this browser; nothing is uploaded.`);
    props.onContext?.({ kind: "folder.opened", summary: `Opened the folder ${place.label} from their own computer. Only its file names are listed; nothing was uploaded.`, subject: { place: place.id } });
  };
  const openLocal = async () => {
    if (!hasDirectoryPicker()) return input.current?.click();
    try {
      const place = await pickDirectory();
      if (place) add(place);
    } catch (error) {
      setNote(error instanceof Error ? error.message : "The folder could not be opened.");
    }
  };
  const onFolderInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (files.length > 0) add(localFilesPlace(files));
  };

  const drag = (node: Node) => (event: DragEvent) => {
    const list = chosen(node);
    if (list.length === 0) return;
    writeDataRefs(event.dataTransfer, refsOf(list), list.map((n) => n.path).join(", "));
    event.dataTransfer.effectAllowed = "copy";
  };

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - 4);
  const last = Math.min(nodes.length, first + Math.ceil(height / rowHeight) + 8);
  const rows = [];
  for (let index = first; index < last; index++) {
    const node = nodes[index]!;
    const opens = node.kind === "place" || node.kind === "folder";
    const isOpen = expanded.has(node.id);
    rows.push(
      <div
        key={node.id}
        id={`sf-files-${index}`}
        className="sf-schema-row sf-browser-row sf-files-row"
        data-kind={node.kind}
        data-active={index === active || undefined}
        data-error={node.error || undefined}
        data-picked={picked.has(node.id) || undefined}
        style={{ top: index * rowHeight, height: rowHeight, paddingInlineStart: `calc(var(--sf-space-2) + ${node.level - 1} * var(--sf-space-4))` }}
        role="treeitem"
        aria-level={node.level}
        aria-expanded={opens ? isOpen : undefined}
        aria-selected={picked.size > 0 ? picked.has(node.id) : index === active}
        draggable={node.item !== undefined}
        onDragStart={node.item ? drag(node) : undefined}
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey) return pick(index, "toggle");
          if (event.shiftKey) return pick(index, "range");
          if (picked.size > 0) {
            setPicked(new Set());
            setNote("");
          }
          setActive(index);
          anchor.current = index;
          toggle(node);
          if (node.item) props.onSelect?.(node.item, node.place);
        }}
        onDoubleClick={() => node.kind === "file" && open(node)}
        onContextMenu={
          node.item
            ? (event) => {
                setActive(index);
                menu.open(event, `${node.label} actions`, menuFor(node));
              }
            : undefined
        }
      >
        <span className="sf-schema-caret" aria-hidden="true" data-open={(opens && isOpen) || undefined}>
          {opens ? "▸" : ""}
        </span>
        <span className="sf-files-icon" data-kind={node.kind} aria-hidden="true" />
        <span className="sf-schema-name">{node.label}</span>
        {node.meta && <span className="sf-schema-meta">{node.meta}</span>}
        {node.tag && <span className="sf-schema-tag">{node.tag}</span>}
        {node.kind === "file" && node.item && props.renderActions && (
          <span className="sf-schema-actions" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            {props.renderActions(node.item, node.place)}
          </span>
        )}
      </div>,
    );
  }

  const nothing = places.length === 0;
  return (
    <div className={["sf-schema sf-files", props.className].filter(Boolean).join(" ")} style={{ height }}>
      {props.local && (
        <div className="sf-files-bar">
          <button type="button" className="sf-button" onClick={() => void openLocal()}>
            Open a folder on this computer
          </button>
          {/* Browsers without a folder picker choose a folder through a file input; its files stay in the page. */}
          <input ref={input} type="file" hidden multiple onChange={onFolderInput} {...({ webkitdirectory: "" } as Record<string, string>)} aria-hidden="true" tabIndex={-1} />
        </div>
      )}
      <div
        ref={list}
        className="sf-schema-list"
        role="tree"
        aria-label={props.label ?? "Folders and files"}
        aria-activedescendant={nodes.length > 0 ? `sf-files-${active}` : undefined}
        aria-multiselectable="true"
        aria-keyshortcuts="Shift+F10 Space Shift+Enter Control+C"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          const node = nodes[active];
          if (event.target === event.currentTarget && node?.item) menu.open(event, `${node.label} actions`, menuFor(node));
        }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: nodes.length * rowHeight, position: "relative" }}>{rows}</div>
        {nothing && (
          <p className="sf-schema-empty">
            {props.sourceId && !storage ? "This backend cannot list a source's storage." : "No place to list."}
            {props.local ? " Open a folder on this computer to browse it here." : ""}
          </p>
        )}
      </div>
      <p className="sf-schema-note" role="status">
        {note}
      </p>
      {menu.element}
    </div>
  );
}
