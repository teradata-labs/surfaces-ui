// @vitest-environment jsdom
import { type ModelChunk, type ModelMessage, toolCallingAgent } from "@surfaces-ui/agent";
import { Chat } from "@surfaces-ui/chat";
import { DataSourceProvider } from "@surfaces-ui/components";
import { memoryDataSource } from "@surfaces-ui/data";
import { EditorView } from "@codemirror/view";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { approvedQueryTool } from "./tools.js";

afterEach(cleanup);

const data = memoryDataSource({
  sourceId: "retail",
  tables: {
    orders: [{ order_id: 1, amount: 40 }, { order_id: 2, amount: 15 }],
    returns: [{ order_id: 2, reason: "damaged" }],
  },
});

describe("an approval before SQL runs", () => {
  it("shows the model's SQL, runs the person's edited version, and hands the rows back to the model", async () => {
    const seen: ModelMessage[][] = [];
    // A stand-in for Claude: asks for one query, then reports what came back.
    const agent = toolCallingAgent({
      system: "s",
      tools: [approvedQueryTool(data, "retail")],
      complete: async function* ({ messages }): AsyncIterable<ModelChunk> {
        seen.push([...messages]);
        const last = messages.at(-1)!;
        if (last.role === "tool") yield { type: "text", delta: "Here is what came back." };
        else yield { type: "tool_call", call: { id: "q1", name: "run_query", input: { sql: "SELECT * FROM orders", why: "Count orders" } } };
        yield { type: "done", model: "stand-in" };
      },
    });

    render(
      <DataSourceProvider dataSource={data}>
        <Chat agent={agent} user={{ id: "u1", name: "Ada" }} />
      </DataSourceProvider>,
    );
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "How many returns?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Run this query?")).toBeTruthy();
    expect(screen.getByText("Count orders")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit before allowing" }));
    // The SQL is edited in the SQL editor (CodeMirror), so the test types through its view.
    const editor = EditorView.findFromDOM(screen.getByLabelText("SQL"))!;
    act(() => editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: "SELECT * FROM returns" } }));
    const allow = screen.getByRole("button", { name: "Allow my version" });
    await waitFor(() => expect((allow as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(allow);

    expect(await screen.findByText("Here is what came back.")).toBeTruthy();
    const result = JSON.parse(seen.at(-1)!.at(-1)!.content);
    expect(result).toEqual({ ran: "SELECT * FROM returns", edited: true, allowedBy: ["Ada"], rows: [{ order_id: 2, reason: "damaged" }] });
  });

  it("never runs when the person says no", async () => {
    let ran = false;
    const tool = approvedQueryTool(data, "retail");
    const agent = toolCallingAgent({
      system: "s",
      tools: [{ ...tool, run: async (...args) => ((ran = true), tool.run(...args)) }],
      complete: async function* ({ messages }): AsyncIterable<ModelChunk> {
        if (messages.at(-1)!.role === "tool") yield { type: "text", delta: "Understood, I did not run it." };
        else yield { type: "tool_call", call: { id: "q1", name: "run_query", input: { sql: "SELECT * FROM orders", why: "Count orders" } } };
      },
    });
    render(<Chat agent={agent} user={{ id: "u1", name: "Ada" }} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Count orders" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.click(await screen.findByRole("button", { name: "Deny" }));
    expect(await screen.findByText("Understood, I did not run it.")).toBeTruthy();
    expect(ran).toBe(false);
  });
});
