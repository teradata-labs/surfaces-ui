// @vitest-environment jsdom
import { agentEvent, scriptedAgent } from "@surfaces-ui/agent";
import { analyticsCatalog } from "@surfaces-ui/spec";
import { lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chat, ChatComposer, type ChatAttachment, type ChatThread, type ComposerHandle, MessageList, emptyThread, parseThread, reduceThread } from "./index.js";

afterEach(cleanup);

const picture: ChatAttachment = { id: "img-1", name: "revenue.png", mediaType: "image/png", size: 1200, preview: "blob:https://app.example.com/abc" };
const csv = (name: string) => new File(["a,b"], name, { type: "text/csv" });
const png = (name: string) => new File(["x"], name, { type: "image/png" });
const typeAndSend = (words: string) => {
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: words } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
};

describe("an attach result that is not a data reference", () => {
  it("shows a picture as a chip with a thumbnail, and sends it with the message", async () => {
    const onSend = vi.fn();
    const attachFiles = vi.fn(async (files: File[]) => files.map((file) => ({ file, attachment: picture })));
    render(<ChatComposer onSend={onSend} attachFiles={attachFiles} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [png("revenue.png")] } });
    expect(screen.getByText("Reading…")).toBeTruthy();
    const attached = await screen.findByRole("list", { name: "Attached to this message" });
    const chip = within(attached).getByText("revenue.png").closest("li")!;
    expect(chip.querySelector("img")?.getAttribute("src")).toBe("blob:https://app.example.com/abc");
    // The name beside it is the picture's text, so the thumbnail is not read out twice.
    expect(chip.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(screen.queryByText("This file cannot be used as data.")).toBeNull();

    typeAndSend("What is this?");
    expect(onSend).toHaveBeenCalledWith("What is this?", [], [picture]);
    expect(screen.queryByRole("list", { name: "Attached to this message" })).toBeNull();
  });

  it("keeps the two-argument call when there is no attachment, as before", () => {
    const onSend = vi.fn();
    render(<ChatComposer onSend={onSend} />);
    typeAndSend("Hello");
    expect(onSend.mock.calls[0]).toEqual(["Hello", []]);
  });

  it("draws a file icon rather than a thumbnail for a non-image or an unsafe preview, and lets one be removed", async () => {
    const attachFiles = async (files: File[]) =>
      files.map((file, i) => ({ file, attachment: i === 0 ? { name: "notes.pdf", mediaType: "application/pdf", preview: "https://x.example.com/n.png" } : { name: "evil.png", mediaType: "image/png", preview: "javascript:alert(1)" } }));
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [csv("notes.pdf"), png("evil.png")] } });
    const attached = await screen.findByRole("list", { name: "Attached to this message" });
    expect(attached.querySelector("img")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remove notes.pdf" }));
    expect(within(attached).queryByText("notes.pdf")).toBeNull();
    expect(within(attached).getByText("evil.png")).toBeTruthy();
  });

  it("lets a host hold the attachments", async () => {
    const onAttachmentsChange = vi.fn();
    const { rerender } = render(<ChatComposer onSend={() => {}} attachFiles={async (files) => files.map((file) => ({ file, attachment: picture }))} onAttachmentsChange={onAttachmentsChange} attachments={[]} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [png("revenue.png")] } });
    await waitFor(() => expect(onAttachmentsChange).toHaveBeenCalledWith([picture]));
    expect(screen.queryByText("revenue.png")).toBeNull();
    rerender(<ChatComposer onSend={() => {}} onAttachmentsChange={onAttachmentsChange} attachments={[picture]} />);
    expect(screen.getByText("revenue.png")).toBeTruthy();
  });

  it("takes a file handled elsewhere without a chip or an error", async () => {
    const attachFiles = async (files: File[]) => files.map((file) => ({ file, taken: true }));
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [csv("big.csv")] } });
    await waitFor(() => expect(screen.queryByText("Reading…")).toBeNull());
    expect(screen.queryByRole("list", { name: "Attached to this message" })).toBeNull();
    expect(screen.queryByText(/cannot be used/)).toBeNull();
  });

  it("still reads a result with no marker as failed, as before", async () => {
    const attachFiles = async (files: File[]) => files.map((file) => ({ file }));
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [csv("x.csv")] } });
    expect(await screen.findByText("This file cannot be used as data.")).toBeTruthy();
  });

  it("mixes: data becomes a table chip, a picture a thumbnail, a taken file nothing", async () => {
    const attachFiles = async (files: File[]) => [
      { file: files[0]!, ref: { sourceId: "local", kind: "table" as const, table: "orders" } },
      { file: files[1]!, attachment: picture },
      { file: files[2]!, taken: true },
    ];
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [csv("orders.csv"), png("revenue.png"), csv("big.csv")] } });
    const attached = await screen.findByRole("list", { name: "Attached to this message" });
    await waitFor(() => expect(within(attached).getAllByRole("listitem")).toHaveLength(2));
    const chips = within(attached).getAllByRole("listitem");
    expect(chips.map((li) => li.getAttribute("data-kind"))).toEqual(["table", "attachment"]);
    expect(chips[1]!.querySelector("img")).not.toBeNull();
    expect(screen.queryByText("big.csv")).toBeNull();
  });
});

describe("the file picker and its menu text", () => {
  it("takes an accept for the picker and a replacement for the fixed menu text", () => {
    render(<ChatComposer onSend={() => {}} attachFiles={async () => []} accept="image/*,.csv" uploadDetail="Pictures and CSV files" />);
    expect(document.querySelector<HTMLInputElement>("input[type=file]")!.accept).toBe("image/*,.csv");
    fireEvent.click(screen.getByRole("button", { name: "Add files or data" }));
    expect(screen.getByText("Pictures and CSV files")).toBeTruthy();
    expect(screen.queryByText(/those that can be read become tables/)).toBeNull();
  });

  it("keeps the old text when none is given", () => {
    render(<ChatComposer onSend={() => {}} attachFiles={async () => []} />);
    fireEvent.click(screen.getByRole("button", { name: "Add files or data" }));
    expect(screen.getByText("Any file; those that can be read become tables")).toBeTruthy();
  });
});

describe("files from outside the composer", () => {
  it("takes files from a handle, with the same Reading… chips", async () => {
    let finish: (value: { file: File; attachment: ChatAttachment }[]) => void = () => {};
    const attachFiles = vi.fn((files: File[]) => new Promise<{ file: File; attachment: ChatAttachment }[]>((resolve) => (finish = resolve)).then((made) => made.map((m) => ({ ...m, file: files[0]! }))));
    const handle = createRef<ComposerHandle>();
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} handleRef={handle} />);
    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = handle.current!.attach([png("revenue.png")]);
    });
    expect(attachFiles).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Reading…")).toBeTruthy();
    await act(async () => {
      finish([{ file: png("revenue.png"), attachment: picture }]);
      await done;
    });
    expect(screen.getByText("revenue.png")).toBeTruthy();
    expect(screen.queryByText("Reading…")).toBeNull();
    act(() => handle.current!.focus());
    expect(document.activeElement).toBe(screen.getByLabelText("Message"));
  });

  it("takes files dropped on a surrounding panel, and highlights while they are over it", async () => {
    const attachFiles = vi.fn(async (files: File[]) => files.map((file) => ({ file, attachment: picture })));
    const panel = document.createElement("div");
    document.body.append(panel);
    render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} dropTarget={panel} />);
    const form = screen.getByLabelText("Message").closest("form")!;
    const file = png("revenue.png");
    const transfer = { files: [file], types: ["Files"], getData: () => "", dropEffect: "" };
    const over = createEvent.dragOver(panel, { dataTransfer: transfer });
    fireEvent(panel, over);
    expect(over.defaultPrevented).toBe(true);
    expect(form.hasAttribute("data-over")).toBe(true);
    fireEvent.drop(panel, { dataTransfer: transfer });
    expect(form.hasAttribute("data-over")).toBe(false);
    await waitFor(() => expect(attachFiles).toHaveBeenCalledWith([file]));
    expect(await screen.findByText("revenue.png")).toBeTruthy();
    panel.remove();
  });

  it("handles a drop once when the panel holds the composer", async () => {
    const attachFiles = vi.fn(async (files: File[]) => files.map((file) => ({ file, attachment: picture })));
    const panel = document.createElement("div");
    document.body.append(panel);
    const { container } = render(<ChatComposer onSend={() => {}} attachFiles={attachFiles} dropTarget={panel} />, { container: panel });
    expect(container).toBe(panel);
    const form = screen.getByLabelText("Message").closest("form")!;
    fireEvent.drop(form, { dataTransfer: { files: [png("a.png")], types: ["Files"], getData: () => "" } });
    await waitFor(() => expect(attachFiles).toHaveBeenCalledTimes(1));
    panel.remove();
  });

  it("ignores a drop on the panel when the composer cannot take files, and stops listening when it goes", () => {
    const panel = document.createElement("div");
    const add = vi.spyOn(panel, "addEventListener");
    const remove = vi.spyOn(panel, "removeEventListener");
    const { unmount } = render(<ChatComposer onSend={() => {}} dropTarget={panel} />);
    const over = createEvent.dragOver(panel, { dataTransfer: { files: [], types: ["Files"], getData: () => "" } });
    fireEvent(panel, over);
    expect(over.defaultPrevented).toBe(false);
    unmount();
    expect(remove.mock.calls.length).toBe(add.mock.calls.length);
  });
});

describe("pictures in the thread", () => {
  it("keeps a sent attachment as a part of the person's message, and parses it back", () => {
    const thread = reduceThread(emptyThread, { type: "user", text: "What is this?", attachments: [picture] }, analyticsCatalog);
    expect(thread.messages[0]!.parts).toEqual([
      { kind: "text", text: "What is this?" },
      { kind: "attachments", attachments: [picture] },
    ]);
    expect(parseThread(JSON.parse(JSON.stringify(thread)))?.messages[0]?.parts[1]).toEqual({ kind: "attachments", attachments: [picture] });
  });

  const withPicture = (preview?: string): ChatThread => reduceThread(emptyThread, { type: "user", text: "Look", attachments: [{ ...picture, preview }] }, analyticsCatalog);
  const list = (thread: ChatThread) => render(<MessageList thread={thread} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} onAction={() => {}} onAnswer={() => {}} />);

  it("shows it on the person's message with its thumbnail", () => {
    const { container } = list(withPicture(picture.preview));
    const chips = screen.getByRole("list", { name: "Attached files" });
    expect(within(chips).getByText("revenue.png")).toBeTruthy();
    expect(container.querySelector(".sf-chat-thumbnail")?.getAttribute("src")).toBe(picture.preview);
  });

  it("shows the name alone when there is no preview or it is not an address a host could make", () => {
    for (const preview of [undefined, "javascript:alert(1)", "//evil.example.com/p.png"]) {
      const { container, unmount } = list(withPicture(preview));
      expect(screen.getByText("revenue.png")).toBeTruthy();
      expect(container.querySelector("img")).toBeNull();
      unmount();
    }
  });

  it("draws an image an agent names in its reply only through the resolver given to the list", () => {
    const reply: ChatThread = { ...emptyThread, messages: [{ id: 1, role: "assistant", generatedBy: "m", streaming: false, parts: [{ kind: "text", text: "See ![A chart](img-7)" }] }] };
    const { container, rerender } = list(reply);
    expect(container.querySelector("img")).toBeNull();
    rerender(<MessageList thread={reply} catalog={analyticsCatalog} renderers={lazyAnalyticsRenderers} onAction={() => {}} onAnswer={() => {}} resolveImage={(src) => `blob:https://app.example.com/${src}`} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:https://app.example.com/img-7");
  });
});

describe("Chat with attachments", () => {
  it("attaches a picture, shows it on the sent message, and sends the agent the text only", async () => {
    const seen: string[] = [];
    const agent = scriptedAgent(function* (request) {
      seen.push(JSON.stringify(request.input));
      yield agentEvent.text("A chart.");
    });
    render(<Chat agent={agent} attachFiles={async (files) => files.map((file) => ({ file, attachment: picture }))} accept="image/*" />);
    fireEvent.change(document.querySelector<HTMLInputElement>("input[type=file]")!, { target: { files: [png("revenue.png")] } });
    await screen.findByRole("list", { name: "Attached to this message" });
    typeAndSend("What is this?");
    expect(await screen.findByText("A chart.")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Attached files" })).getByText("revenue.png")).toBeTruthy();
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain("revenue.png");
  });
});
