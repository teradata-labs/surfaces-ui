// @vitest-environment jsdom
import { memoryDataSource, memorySurfaceLibrary } from "@surfaces-ui/data";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AnalyticsChatPage } from "./App.js";
import { analystAgent, echoModel } from "./agent.js";

afterEach(cleanup);

describe("analytics chat recipe", () => {
  it("offers the agent's models and skills, runs a turn on the chosen model, and keeps the conversation", async () => {
    const dataSource = memoryDataSource({ sourceId: "shop", tables: { orders: [{ order_id: 1, amount: 10 }] } });
    const library = memorySurfaceLibrary();
    render(<AnalyticsChatPage agent={analystAgent(dataSource, echoModel)} dataSource={dataSource} library={library} sourceId="shop" />);

    fireEvent.click(await screen.findByRole("button", { name: "Model: Claude Sonnet 5.5" }));
    fireEvent.click(screen.getByRole("radio", { name: /Claude Opus 5.5/ }));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "How many orders?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Answered by claude-opus-5-5.")).toBeTruthy();

    // Saved to the library as a conversation, titled from the question.
    await waitFor(async () => expect((await library.listSurfaces({})).surfaces.map((s) => s.title)).toEqual(["How many orders?"]));
  });
});
