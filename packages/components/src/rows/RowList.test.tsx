// @vitest-environment jsdom
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { SortDirection } from "@surfaces-ui/proto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ROW_LIST_MAX, RowList } from "./RowList.js";

const posts = Array.from({ length: 45 }, (_, i) => ({ post_id: i + 1, author: `user${(i % 3) + 1}`, body: `Post ${i + 1}`, likes: i * 2 }));
const dataSource: DataSource = memoryDataSource({ tables: { posts } });
const sql = "SELECT * FROM posts";
const row = (r: Record<string, unknown>) => (
  <article>
    <b>{String(r.author)}</b> {String(r.body)} <button type="button">Like {String(r.post_id)}</button>
  </article>
);

afterEach(cleanup);

describe("RowList", () => {
  it("draws one item per row of a page the engine sorted, each with its own controls, and fetches more when asked", async () => {
    const onContext = vi.fn();
    const execute = vi.spyOn(dataSource, "execute");
    render(<RowList dataSource={dataSource} sourceId="memory" sql={sql} label="Posts" pageSize={20} rowKey="post_id" sorts={[{ column: "likes", direction: SortDirection.DESC }]} renderRow={row} onContext={onContext} />);
    const list = await screen.findByRole("list", { name: "Posts" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(20));
    // The most liked first: the order is the engine's, over the whole table.
    expect(within(list).getAllByRole("listitem")[0]!.textContent).toContain("Post 45");
    expect(within(list).getByRole("button", { name: "Like 45" })).toBeTruthy();
    // One row past the page says there is more, so nothing is counted.
    expect(execute.mock.calls[0]![0].query?.page).toMatchObject({ limit: 21, offset: 0n });
    expect(screen.getByRole("status").textContent).toBe("Showing the first 20.");

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(40));
    expect(onContext).toHaveBeenCalledWith(expect.objectContaining({ kind: "rows.more" }));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(45));
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(within(list).getAllByRole("listitem")[44]!.textContent).toContain("Post 1");
    execute.mockRestore();
  });

  it("starts again from the first page when the query changes, and says when there is nothing", async () => {
    const view = render(<RowList dataSource={dataSource} sourceId="memory" sql={sql} label="Posts" pageSize={10} renderRow={row} />);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(10));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(20));
    const filters = [{ column: "author", operator: 1, values: [{ kind: { case: "stringValue" as const, value: "user1" } }] }];
    view.rerender(<RowList dataSource={dataSource} sourceId="memory" sql={sql} label="Posts" pageSize={10} filters={filters} renderRow={row} />);
    await waitFor(() => expect(screen.getAllByRole("listitem").every((item) => item.textContent!.includes("user1"))).toBe(true));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    view.rerender(<RowList dataSource={dataSource} sourceId="memory" sql={sql} label="Posts" filters={[{ ...filters[0]!, values: [{ kind: { case: "stringValue" as const, value: "nobody" } }] }]} renderRow={row} />);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Nothing to show."));
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("holds a bounded number of rows however often more is asked for, and reports a query that fails", async () => {
    const many = memoryDataSource({ tables: { posts: Array.from({ length: 500 }, (_, i) => ({ post_id: i, body: `Post ${i}` })) } });
    render(<RowList dataSource={many} sourceId="memory" sql={sql} label="Posts" pageSize={100} renderRow={(r) => <span>{String(r.body)}</span>} />);
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(100));
    fireEvent.click(screen.getByRole("button", { name: "Show more" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(ROW_LIST_MAX));
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Showing the first 200. Filter to find others.");
    cleanup();
    render(<RowList dataSource={many} sourceId="memory" sql="SELECT * FROM missing" label="Posts" renderRow={() => null} />);
    expect((await screen.findByRole("alert")).textContent).toBeTruthy();
  });
});
