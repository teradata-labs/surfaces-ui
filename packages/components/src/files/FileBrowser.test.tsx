// @vitest-environment jsdom
import { memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DATA_REFS_MIME, dataRefLabel, readDataRefs, writeDataRefs } from "../schema/refs.js";
import { FileBrowser } from "./FileBrowser.js";
import { type FilePlace, fileFormatByName, fileSize, localFilesPlace, sourceFiles } from "./files.js";

afterEach(cleanup);

const files = [
  { path: "lake/orders/2024.parquet", sizeBytes: 14_540, modifiedAt: "2026-03-01T10:00:00Z", table: "orders" },
  { path: "lake/orders/2025.parquet", sizeBytes: 2_400_000 },
  { path: "lake/readme.txt", sizeBytes: 12 },
  { path: "lake/customers.csv", sizeBytes: 900 },
];
const data = () => memoryDataSource({ tables: {}, sourceId: "lake", files });
const row = (name: RegExp | string) => screen.getByRole("treeitem", { name });
const names = () => screen.getAllByRole("treeitem").map((r) => r.querySelector(".sf-schema-name")?.textContent);

/** A file as a folder input gives it: with its path inside the chosen folder. */
function localFile(path: string, body = "x"): File {
  const file = new File([body], path.split("/").at(-1)!, { lastModified: Date.UTC(2026, 0, 2) });
  Object.defineProperty(file, "webkitRelativePath", { value: path });
  return file;
}

describe("file places", () => {
  it("names formats and sizes", () => {
    expect([fileFormatByName("a.PARQUET"), fileFormatByName("b.csv.gz"), fileFormatByName("c.jsonl"), fileFormatByName("d.txt")]).toEqual(["parquet", "csv", "json", undefined]);
    expect([fileSize(812), fileSize(14_540), fileSize(3_300_000_000), fileSize(undefined)]).toEqual(["812 B", "14.2 KB", "3.1 GB", ""]);
  });

  it("lists a source's storage through the backend, a page at a time, and is absent when the backend cannot", async () => {
    expect(sourceFiles(memoryDataSource({ tables: {} }), "memory")).toBeUndefined();
    const place = sourceFiles(data(), "lake", "Lake", 2)!;
    expect((await place.list("")).items.map((i) => [i.name, i.kind])).toEqual([["lake", "folder"]]);
    const first = await place.list("lake");
    expect(first.items.map((i) => i.name)).toEqual(["orders", "customers.csv"]);
    expect(first.next).toBe("2");
    expect((await place.list("lake", first.next)).items.map((i) => i.name)).toEqual(["readme.txt"]);
    expect((await place.list("lake/orders")).items[0]).toMatchObject({ name: "2024.parquet", size: 14_540, format: "parquet", table: "orders" });
  });

  it("lists a folder from this computer without its hidden files, keeping each file in the page", async () => {
    const place = localFilesPlace([localFile("sales/2024/q1.csv"), localFile("sales/notes.md"), localFile("sales/.DS_Store"), localFile("sales/.git/config")]);
    expect(place).toMatchObject({ id: "local:sales", label: "sales", origin: "local" });
    expect((await place.list("")).items.map((i) => [i.name, i.kind])).toEqual([["sales", "folder"]]);
    expect((await place.list("sales")).items.map((i) => [i.name, i.kind])).toEqual([
      ["2024", "folder"],
      ["notes.md", "file"],
    ]);
    const [q1] = (await place.list("sales/2024")).items;
    expect(q1).toMatchObject({ path: "sales/2024/q1.csv", format: "csv" });
    expect(q1!.file).toBeInstanceOf(File);
  });
});

describe("file references", () => {
  it("travel on a drag beside tables, named by the end of their path", () => {
    const store = new Map<string, string>();
    const transfer = { setData: (type: string, value: string) => void store.set(type, value), getData: (type: string) => store.get(type) ?? "", types: [] as string[] };
    writeDataRefs(transfer, [
      { sourceId: "lake", kind: "file", table: "", path: "/data/lake/orders/2024.parquet" },
      { sourceId: "lake", kind: "table", table: "orders" },
    ]);
    const back = readDataRefs(transfer);
    expect(back.map((r) => r.kind)).toEqual(["file", "table"]);
    expect(back.map(dataRefLabel)).toEqual(["orders/2024.parquet", "orders"]);
    expect(JSON.parse(store.get(DATA_REFS_MIME)!)).toHaveLength(2);
    // Something with neither a table nor a path is not a reference.
    store.set(DATA_REFS_MIME, JSON.stringify([{ sourceId: "lake", table: "" }]));
    expect(readDataRefs(transfer)).toEqual([]);
  });
});

describe("FileBrowser", () => {
  it("opens a source's storage, shows what each file is, and loads a folder when it is opened", async () => {
    const onOpen = vi.fn();
    render(<FileBrowser dataSource={data()} sourceId="lake" sourceLabel="Lake" onOpen={onOpen} height={400} />);
    await waitFor(() => expect(row(/^lake/)).toBeTruthy());
    expect(row(/^Lake/).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(row(/^lake/));
    await waitFor(() => expect(row(/customers\.csv/)).toBeTruthy());
    expect(row(/customers\.csv/).textContent).toContain("900 B");
    expect(row(/customers\.csv/).textContent).toContain("csv");
    fireEvent.click(row(/^orders/));
    await waitFor(() => expect(row(/2024\.parquet/).textContent).toContain("table orders"));
    fireEvent.doubleClick(row(/2024\.parquet/));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ path: "lake/orders/2024.parquet", format: "parquet" }), expect.objectContaining({ id: "lake", origin: "source" }));
  });

  it("works from the keyboard: arrows open and close folders, Space selects, Shift+Enter hands the selection over", async () => {
    const onAttach = vi.fn();
    render(<FileBrowser dataSource={data()} sourceId="lake" onAttach={onAttach} height={400} />);
    const tree = screen.getByRole("tree");
    await waitFor(() => expect(row(/^lake/)).toBeTruthy());
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    await waitFor(() => expect(row(/customers\.csv/)).toBeTruthy());
    expect(names()).toEqual(["lake", "lake", "orders", "customers.csv", "readme.txt"]);
    // Down to orders, select it; down to customers.csv, select that too.
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: " " });
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    fireEvent.keyDown(tree, { key: " " });
    expect(screen.getByRole("status").textContent).toMatch(/^2 selected/);
    fireEvent.keyDown(tree, { key: "Enter", shiftKey: true });
    expect(onAttach).toHaveBeenCalledTimes(1);
    expect(onAttach.mock.calls[0]![0]).toEqual([
      { sourceId: "lake", kind: "file", table: "", path: "lake/orders" },
      { sourceId: "lake", kind: "file", table: "", path: "lake/customers.csv" },
    ]);
    fireEvent.keyDown(tree, { key: "Escape" });
    expect(tree.querySelectorAll("[data-picked]")).toHaveLength(0);
    // Left on a file goes to its folder; left again closes it.
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    fireEvent.keyDown(tree, { key: "ArrowLeft" });
    expect(names()).toEqual(["lake", "lake"]);
  });

  it("has a menu on a row whose items all have a key, and says when a backend cannot list storage", async () => {
    const onAttach = vi.fn();
    const { unmount } = render(<FileBrowser dataSource={data()} sourceId="lake" sourceLabel="Storage" onAttach={onAttach} attachLabel="Add to instruction" height={400} />);
    await waitFor(() => expect(row(/^lake/)).toBeTruthy());
    fireEvent.contextMenu(row(/^lake/));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual(["Open folderEnter", "Add to instructionShift+Enter", "SelectSpace", "Copy pathCtrl+C"]);
    fireEvent.click(items[1]!);
    expect(onAttach).toHaveBeenCalledWith([{ sourceId: "lake", kind: "file", table: "", path: "lake" }], [expect.objectContaining({ name: "lake" })]);
    unmount();

    render(<FileBrowser dataSource={memoryDataSource({ tables: {} })} sourceId="memory" local height={300} />);
    expect(screen.getByText(/cannot list a source's storage/).textContent).toContain("Open a folder on this computer");
    expect(screen.getByRole("button", { name: "Open a folder on this computer" })).toBeTruthy();
  });

  it("lists a folder opened from this computer beside the source, shows pages on demand and reports a place that fails", async () => {
    const many: FilePlace = {
      id: "local:big",
      label: "big",
      origin: "local",
      list: async (path, page) => (path ? { items: [] } : page ? { items: [{ name: "b.csv", path: "big/b.csv", kind: "file" }] } : { items: [{ name: "a.csv", path: "big/a.csv", kind: "file" }], next: "1" }),
    };
    const broken: FilePlace = { id: "s3", label: "Bucket", origin: "source", list: () => Promise.reject(new Error("[unsupported] That location is outside what this source may read.")) };
    const onAttach = vi.fn();
    render(<FileBrowser dataSource={data()} sourceId="lake" sourceLabel="Storage" places={[many, broken]} onAttach={onAttach} height={400} />);
    await waitFor(() => expect(row(/a\.csv/)).toBeTruthy());
    expect(row(/^big/).textContent).toContain("this computer");
    fireEvent.click(row(/Show more/));
    await waitFor(() => expect(row(/b\.csv/)).toBeTruthy());
    expect(screen.queryByRole("treeitem", { name: /Show more/ })).toBeNull();
    await waitFor(() => expect(row(/outside what this source may read/)).toBeTruthy());
    // A local file's reference names the folder it was opened from, never a path above it.
    fireEvent.contextMenu(row(/a\.csv/));
    fireEvent.click(screen.getByRole("menuitem", { name: /Add to chat/ }));
    expect(onAttach.mock.calls[0]![0]).toEqual([{ sourceId: "local:big", kind: "file", table: "", path: "big/a.csv" }]);
  });
});
