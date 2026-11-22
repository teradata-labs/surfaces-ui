// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog, useConfirm } from "./ConfirmDialog.js";

afterEach(cleanup);

describe("ConfirmDialog", () => {
  it("asks with the action's own name, and says what will happen", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Turn off 5 accounts?" body="They are signed out now." confirmLabel="Turn off" danger onConfirm={onConfirm} onCancel={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Turn off 5 accounts?" });
    expect(dialog.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("They are signed out now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("starts on Cancel for something that takes away, and on the action otherwise", () => {
    const { rerender } = render(<ConfirmDialog open title="Remove?" danger onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    rerender(<ConfirmDialog open={false} title="Remove?" onConfirm={() => {}} onCancel={() => {}} />);
    rerender(<ConfirmDialog open title="Send?" confirmLabel="Send" onConfirm={() => {}} onCancel={() => {}} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Send" }));
  });

  it("cancels on Escape and answers only once", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog open title="Go?" onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("puts focus back where it was when it closes", () => {
    const { rerender } = render(
      <>
        <button type="button">Open</button>
        <ConfirmDialog open={false} title="Go?" onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    screen.getByRole("button", { name: "Open" }).focus();
    rerender(
      <>
        <button type="button">Open</button>
        <ConfirmDialog open title="Go?" onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Confirm" }));
    rerender(
      <>
        <button type="button">Open</button>
        <ConfirmDialog open={false} title="Go?" onConfirm={() => {}} onCancel={() => {}} />
      </>,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open" }));
  });
});

describe("useConfirm", () => {
  function Asker({ onAnswer }: { onAnswer(yes: boolean): void }) {
    const { confirm, element } = useConfirm();
    return (
      <>
        <button type="button" onClick={() => void confirm({ title: "Make 3 admins?", confirmLabel: "Make admins" }).then(onAnswer)}>
          Ask
        </button>
        {element}
      </>
    );
  }

  it("resolves true on the action and false on Cancel, closing each time", async () => {
    const onAnswer = vi.fn();
    render(<Asker onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Make admins" })));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
  });

  it("answers an earlier question with false when asked again", async () => {
    const onAnswer = vi.fn();
    render(<Asker onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask", hidden: true })));
    expect(onAnswer).toHaveBeenCalledWith(false);
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
});
