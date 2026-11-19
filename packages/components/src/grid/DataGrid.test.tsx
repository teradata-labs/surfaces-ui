// @vitest-environment jsdom
import { type DataSource, memoryDataSource } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Int32, Table, Utf8, vectorFromArray } from "apache-arrow";
import { afterEach, describe, expect, it } from "vitest";
import { DataSourceProvider } from "../data/DataSourceProvider.js";
import { DataGrid } from "./DataGrid.js";

afterEach(cleanup);

const N = 100_000;
function bigSource() {
  const table = new Table({
    id: vectorFromArray(Array.from({ length: N }, (_, i) => i + 1), new Int32()),
    name: vectorFromArray(Array.from({ length: N }, (_, i) => (i % 10 === 3 ? null : `row ${i + 1}`)), new Utf8()),
  });
  const source = memoryDataSource({ tables: { big: table } });
  const calls: { limit: number; offset: number; sorts: number }[] = [];
  const spy: DataSource = {
    ...source,
    execute(request, options) {
      calls.push({
        limit: request.query?.page?.limit ?? 0,
        offset: Number(request.query?.page?.offset ?? 0n),
        sorts: request.query?.sorts?.length ?? 0,
      });
      return source.execute(request, options);
    },
  };
  return { spy, calls };
}

const cells = () => [...document.querySelectorAll(".sf-grid-row")].map((r) => r.textContent);
const scrollTo = (top: number) => {
  const scroller = screen.getByRole("grid");
  scroller.scrollTop = top;
  fireEvent.scroll(scroller);
};

describe("DataGrid", () => {
  it("renders only the visible rows of a large result and fetches one block", async () => {
    const { spy, calls } = bigSource();
    render(<DataGrid dataSource={spy} sourceId="memory" sql="SELECT * FROM big" height={400} rowHeight={20} />);
    await screen.findByText("100,000 rows");
    await waitFor(() => expect(cells()[0]).toBe("1row 1"));
    expect(document.querySelectorAll(".sf-grid-row").length).toBeLessThan(60);
    expect(calls).toEqual([{ limit: 200, offset: 0, sorts: 0 }]);
    expect(screen.getByRole("grid").getAttribute("aria-rowcount")).toBe("100001");
    expect(screen.getAllByText("null")[0]!.getAttribute("data-null")).toBe("true");
  });

  it("loads the block it scrolls to, not the ones in between", async () => {
    const { spy, calls } = bigSource();
    render(<DataGrid dataSource={spy} sourceId="memory" sql="SELECT * FROM big" height={400} rowHeight={20} />);
    await screen.findByText("100,000 rows");
    scrollTo(50_000 * 20);
    await waitFor(() => expect(cells().some((c) => c === "50001row 50001")).toBe(true));
    const offsets = calls.map((c) => c.offset);
    expect(offsets.every((o) => o === 0 || (o >= 49_800 && o <= 50_200))).toBe(true);
    expect(calls.length).toBeLessThanOrEqual(3);
  });

  it("sorts by asking the source again, cycling ascending, descending, none", async () => {
    const { spy, calls } = bigSource();
    render(<DataGrid dataSource={spy} sourceId="memory" sql="SELECT * FROM big" height={400} rowHeight={20} />);
    await screen.findByText("100,000 rows");
    const header = () => screen.getByRole("columnheader", { name: /^id/ });
    fireEvent.click(screen.getByRole("button", { name: /^id/ }));
    fireEvent.click(screen.getByRole("button", { name: /^id/ }));
    expect(header().getAttribute("aria-sort")).toBe("descending");
    await waitFor(() => expect(cells()[0]).toBe("100000row 100000"));
    expect(calls.at(-1)).toEqual({ limit: 200, offset: 0, sorts: 1 });
    fireEvent.click(screen.getByRole("button", { name: /^id/ }));
    expect(header().getAttribute("aria-sort")).toBe("none");
  });

  it("maps the scrollbar proportionally when rows exceed the browser's height limit", async () => {
    const { spy } = bigSource();
    render(<DataGrid dataSource={spy} sourceId="memory" sql="SELECT * FROM big" height={400} rowHeight={200} />);
    await screen.findByText("100,000 rows");
    const body = document.querySelector<HTMLElement>(".sf-grid-body")!;
    expect(body.style.height).toBe("10000000px");
    scrollTo(10_000_000);
    await waitFor(() => expect(cells().some((c) => c === "100000row 100000")).toBe(true));
  });

  it("pages when asked to", async () => {
    const { spy, calls } = bigSource();
    render(
      <DataSourceProvider dataSource={spy}>
        <DataGrid sourceId="memory" sql="SELECT * FROM big" mode="pages" pageSize={25} height={900} rowHeight={20} />
      </DataSourceProvider>,
    );
    await screen.findByText("Page 1 of 4,000");
    await waitFor(() => expect(cells()).toHaveLength(25));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(cells()[0]).toBe("26row 26"));
    expect(calls.at(-1)).toEqual({ limit: 25, offset: 25, sorts: 0 });
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows errors and empty results", async () => {
    const source = memoryDataSource({ tables: { t: [{ a: 1 }] } });
    const { rerender } = render(<DataGrid dataSource={source} sourceId="memory" sql="SELECT * FROM missing" />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Table not found/);
    rerender(
      <DataGrid
        dataSource={source}
        sourceId="memory"
        sql="SELECT * FROM t"
        filters={[{ column: "a", operator: 5, values: [{ kind: { case: "intValue", value: 5n } }] }]}
      />,
    );
    expect(await screen.findByText("No rows match.")).toBeTruthy();
  });
});

describe("counting", () => {
  it("does not run a count when the first block already shows every row", async () => {
    const small = memoryDataSource({ tables: { t: Array.from({ length: 7 }, (_, i) => ({ id: i })) } });
    let counts = 0;
    const counting: DataSource = { ...small, count: (request, options) => (counts++, small.count(request, options)) };
    render(<DataGrid dataSource={counting} sourceId="memory" sql="SELECT * FROM t" height={300} rowHeight={30} />);
    await waitFor(() => expect(screen.getByText("7 rows")).toBeTruthy());
    expect(counts).toBe(0);
  });
});
