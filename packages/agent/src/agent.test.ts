import { describe, expect, it } from "vitest";
import { type AgentEvent, UNREAD_SURFACE, agentEvent, errorEvent, extractSurfaces, scriptedAgent } from "./index.js";
import { turnText } from "./turn.js";

async function* from(events: AgentEvent[]) {
  yield* events;
}
async function summary(stream: AsyncIterable<AgentEvent>) {
  const out: string[] = [];
  for await (const next of stream) {
    const e = next.event;
    if (e.case === "text") {
      const last = out.at(-1);
      if (last?.startsWith("text:")) out[out.length - 1] = last + e.value.delta;
      else out.push(`text:${e.value.delta}`);
    } else if (e.case === "surface") out.push(`surface:${Object.keys(e.value).find((k) => k !== "version")}`);
    else out.push(e.case ?? "?");
  }
  return out;
}

describe("extractSurfaces", () => {
  const create = '{"version":"1.0","createSurface":{"surfaceId":"s","catalogId":"c"}}';
  const update = '{"version":"1.0","updateComponents":{"surfaceId":"s","components":[{"id":"root","component":"Text","text":"Hi"}]}}';
  const reply = `Here is the chart.\n\n\`\`\`a2ui\n${create}\n${update}\n\`\`\`\nAnything else?`;

  it("turns fenced A2UI lines into surface events and removes them from the text", async () => {
    expect(await summary(extractSurfaces(from([agentEvent.text(reply), agentEvent.done("s1", "m")])))).toEqual([
      "text:Here is the chart.\n\n",
      "surface:createSurface",
      "surface:updateComponents",
      "text:Anything else?",
      "done",
    ]);
  });

  it("gives the same result however the text is split into deltas", async () => {
    const whole = await summary(extractSurfaces(from([agentEvent.text(reply)])));
    for (const size of [1, 2, 3, 7, 16, 50]) {
      const deltas = Array.from({ length: Math.ceil(reply.length / size) }, (_, i) => agentEvent.text(reply.slice(i * size, (i + 1) * size)));
      expect(await summary(extractSurfaces(from(deltas))), `chunk size ${size}`).toEqual(whole);
    }
  });

  it("emits each surface line as soon as it is complete", async () => {
    const seen: string[] = [];
    async function* slow() {
      yield agentEvent.text("```a2ui\n" + create + "\n");
      seen.push("first line sent");
      yield agentEvent.text(update);
      seen.push("second line partly sent");
      yield agentEvent.text("\n```\n");
    }
    for await (const next of extractSurfaces(slow())) seen.push(next.event.case === "surface" ? "surface" : "other");
    expect(seen).toEqual(["surface", "first line sent", "second line partly sent", "surface"]);
  });

  it("leaves ordinary code blocks alone, drops bad lines, and survives an unclosed fence", async () => {
    const code = "Run this:\n```sql\nSELECT 1\n```\n";
    expect(await summary(extractSurfaces(from([agentEvent.text(code)])))).toEqual([`text:${code}`]);
    expect(await summary(extractSurfaces(from([agentEvent.text("```a2ui\nnot json\n[1,2]\n" + create + "\n```\n")])))).toEqual(["surface:createSurface", "error"]);
    expect(await summary(extractSurfaces(from([agentEvent.text("```a2ui\n" + create + "\n" + update)])))).toEqual(["surface:createSurface", "surface:updateComponents"]);
    expect(await summary(extractSurfaces(from([agentEvent.text("ends with a backtick `")])))).toEqual(["text:ends with a backtick `"]);
  });

  it("reads a message written over several lines, however the text is split", async () => {
    const pretty = JSON.stringify(JSON.parse(update), null, 2);
    // A component on a line of its own is a whole JSON object, and a string may hold brackets.
    const spread = pretty.replace('"Hi"', '"Hi } ] \\" {"');
    const text = `Done.\n\`\`\`a2ui\n${create}\n${spread}\n\`\`\`\nNext?`;
    const expected = ["text:Done.\n", "surface:createSurface", "surface:updateComponents", "text:Next?"];
    expect(await summary(extractSurfaces(from([agentEvent.text(text)])))).toEqual(expected);
    for (const size of [1, 5, 40]) {
      const deltas = Array.from({ length: Math.ceil(text.length / size) }, (_, i) => agentEvent.text(text.slice(i * size, (i + 1) * size)));
      expect(await summary(extractSurfaces(from(deltas))), `chunk size ${size}`).toEqual(expected);
    }
    const events: AgentEvent[] = [];
    for await (const next of extractSurfaces(from([agentEvent.text(text)]))) events.push(next);
    const sent = events.find((e) => e.event.case === "surface" && "updateComponents" in e.event.value)!.event.value as { updateComponents: { components: { text: string }[] } };
    expect(sent.updateComponents.components[0]!.text).toBe('Hi } ] " {');
  });

  it("reads a list of messages, with or without its brackets", async () => {
    expect(await summary(extractSurfaces(from([agentEvent.text("```a2ui\n[\n" + create + ",\n" + update + "\n]\n```\n")])))).toEqual(["surface:createSurface", "surface:updateComponents"]);
    expect(await summary(extractSurfaces(from([agentEvent.text("```a2ui\n" + create + ",\n" + update + "\n```\n")])))).toEqual(["surface:createSurface", "surface:updateComponents"]);
  });

  it("says so once when a block holds text that is not a message, and keeps what it could read", async () => {
    const cut = update.slice(0, -3);
    const events: AgentEvent[] = [];
    for await (const next of extractSurfaces(from([agentEvent.text("```a2ui\n" + create + "\n" + cut + "\n```\nI changed the page."), agentEvent.done("s", "m")]))) events.push(next);
    expect(await summary(from(events))).toEqual(["surface:createSurface", "error", "text:I changed the page.", "done"]);
    const error = events.find((e) => e.event.case === "error")!.event.value as { code: string; message: string };
    expect(error.code).toBe(UNREAD_SURFACE);
    expect(error.message).toContain("could not be read");
    // A line that is balanced but broken costs only itself.
    expect(await summary(extractSurfaces(from([agentEvent.text('```a2ui\n{"version": oops}\n' + create + "\n```\n")])))).toEqual(["surface:createSurface", "error"]);
    // A reply that ends inside a message that never closed.
    expect(await summary(extractSurfaces(from([agentEvent.text("```a2ui\n" + cut)])))).toEqual(["error"]);
  });

  it("keeps other events in order with the text around them", async () => {
    const events = [agentEvent.text("Looking"), agentEvent.step({ id: "1", title: "Query" }), agentEvent.text(" done"), agentEvent.done("s", "m")];
    expect(await summary(extractSurfaces(from(events)))).toEqual(["text:Looking", "step", "text: done", "done"]);
  });
});

describe("scriptedAgent and errors", () => {
  it("plays turns in order and stops when aborted", async () => {
    const agent = scriptedAgent((request, turn) => [agentEvent.text(`turn ${turn}: ${request.input?.case === "text" ? request.input.value : ""}`), agentEvent.done("s", "script")]);
    expect(await summary(agent.send({ input: { case: "text", value: "hi" } }))).toEqual(["text:turn 0: hi", "done"]);
    expect(await summary(agent.send({ input: { case: "text", value: "again" } }))).toEqual(["text:turn 1: again", "done"]);
    const controller = new AbortController();
    controller.abort();
    expect(await summary(agent.send({ input: { case: "text", value: "x" } }, { signal: controller.signal }))).toEqual(["error"]);
  });

  it("classifies failures", () => {
    const code = (e: unknown) => (errorEvent(e).event.value as { code: string }).code;
    expect(code(new TypeError("Failed to fetch"))).toBe("UNAVAILABLE");
    expect(code(new DOMException("aborted", "AbortError"))).toBe("CANCELLED");
    expect(code(new Error("[internal] boom"))).toBe("FAILED");
    expect((errorEvent(new Error("[internal] boom")).event.value as { message: string }).message).toBe("boom");
  });
});

describe("turnText with attachments", () => {
  it("names the tables and columns a person attached, with the database as part of a table's name", () => {
    const text = turnText({
      input: { case: "text", value: "What drives this?" },
      references: [
        { sourceId: "td", schema: "sales", table: "fct_orders" },
        { sourceId: "td", schema: "sales", table: "fct_orders", column: "total_amount" },
        { sourceId: "retail", table: "stores" },
      ],
    });
    expect(text.split("\n")[0]).toBe("What drives this?");
    expect(text).toContain("The person attached these to the message");
    expect(text).toContain('- table sales.fct_orders, source "td"');
    expect(text).toContain('- column total_amount of table sales.fct_orders, source "td"');
    expect(text).toContain('- table stores, source "retail"');
  });

  it("names an attached file by its path, and says a file on the person's computer cannot be read", () => {
    const text = turnText({
      input: { case: "text", value: "Can we load these?" },
      references: [
        { sourceId: "lake", path: "s3://acme-lake/sales/2026/orders.parquet" },
        { sourceId: "local:field-data", path: "field-data/2026/store_visits.csv" },
      ],
    });
    expect(text).toContain('- file or folder s3://acme-lake/sales/2026/orders.parquet, in the storage of source "lake"');
    expect(text).toContain("- file or folder field-data/2026/store_visits.csv, in a folder the person opened on their own computer (you cannot read it");
  });

  it("tells a model what the person did on the page since its last reply, as context and not as a request", () => {
    const text = turnText({
      input: { case: "text", value: "What should I add next?" },
      surfaces: [
        {
          surfaceId: "main",
          activity: [
            { componentId: "report", kind: "view.added", summary: "Added to the report: Refund rate by Category.", subject: { tile: "tile-4", rows: ["category"], values: ["rate"] }, at: "2026-11-15T10:00:00Z" },
            { componentId: "report", kind: "point.selected", summary: "Clicked South: the report is filtered to region is South.", at: "2026-11-15T10:00:05Z" },
          ],
        },
      ],
    });
    expect(text).toContain("Since your last reply the person did these on the page, oldest first (for your context; they are not requests):");
    expect(text).toContain('- [view.added] Added to the report: Refund rate by Category. (in "report" of surface "main") {"tile":"tile-4","rows":["category"],"values":["rate"]}');
    expect(text).toContain('- [point.selected] Clicked South: the report is filtered to region is South. (in "report" of surface "main")');
    expect(text.indexOf("view.added")).toBeLessThan(text.indexOf("point.selected"));
    expect(turnText({ input: { case: "text", value: "Hi" }, surfaces: [{ surfaceId: "main", activity: [] }] })).toBe("Hi");
  });

  it("says nothing about attachments when there are none", () => {
    expect(turnText({ input: { case: "text", value: "Hello" } })).toBe("Hello");
  });
});
