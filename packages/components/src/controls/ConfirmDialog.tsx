import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { label as text } from "../locale/locale.js";

export interface ConfirmDialogProps {
  /** Whether the dialog is showing. */
  open: boolean;
  /** The question, as a heading: "Turn off 5 accounts?" */
  title: string;
  /** What will happen, and what cannot be undone. */
  body?: ReactNode;
  /** The button that goes ahead, named for what it does: "Turn off", not "OK". Defaults to "Confirm". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** For something that takes away or cannot be undone: the button is marked, and Cancel has focus first. */
  danger?: boolean;
  onConfirm(): void;
  /** Cancel, Escape, or a press outside the dialog. */
  onCancel(): void;
  className?: string;
}

/**
 * Asks a person to confirm one action before it runs, as a modal dialog: the page behind cannot be used, focus starts
 * inside it and returns where it was, and Escape cancels. Name the button for the action. For something that can be
 * undone, prefer doing it and offering Undo (`ActionReceipt`). `useConfirm` asks from code and waits for the answer.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel, danger, onConfirm, onCancel, className }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const answered = useRef(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      answered.current = false;
      const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // A browser without modal dialogs (and jsdom) still shows it, without making the page behind inert.
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
      (danger ? cancel : confirm).current?.focus();
      return () => {
        if (element.open) element.close?.();
        element.removeAttribute("open");
        back?.focus();
      };
    }
    return undefined;
  }, [open, danger]);

  const answer = (yes: boolean) => {
    if (answered.current) return;
    answered.current = true;
    if (yes) onConfirm();
    else onCancel();
  };

  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      className={["sf-confirm", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-describedby={body ? bodyId : undefined}
      onCancel={(event) => {
        // Escape: answer as Cancel, and let React close it.
        event.preventDefault();
        answer(false);
      }}
      onMouseDown={(event) => {
        // A press on the backdrop lands on the dialog itself, outside its box.
        if (event.target === dialog.current) {
          const box = dialog.current.getBoundingClientRect();
          const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
          if (!inside) answer(false);
        }
      }}
    >
      <h2 id={titleId} className="sf-confirm-title">
        {title}
      </h2>
      {body && (
        <div id={bodyId} className="sf-confirm-body">
          {body}
        </div>
      )}
      <div className="sf-confirm-actions">
        <button ref={cancel} type="button" className="sf-button" onClick={() => answer(false)}>
          {cancelLabel ?? text("confirm.cancel")}
        </button>
        <button ref={confirm} type="button" className="sf-button" data-variant={danger ? "danger" : "primary"} onClick={() => answer(true)}>
          {confirmLabel ?? text("confirm.confirm")}
        </button>
      </div>
    </dialog>
  );
}

/** What `useConfirm`'s `confirm` asks. */
export type ConfirmRequest = Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel">;

export interface Confirm {
  /** Shows the dialog and resolves true if the person goes ahead, false if not. Asking again while one is open answers the first with false. */
  confirm(request: ConfirmRequest): Promise<boolean>;
  /** Render this once, anywhere in the component. */
  element: ReactNode;
}

/** Asks for confirmation from an event handler: `if (await confirm({ title, body, confirmLabel, danger })) run()`. */
export function useConfirm(): Confirm {
  const [request, setRequest] = useState<ConfirmRequest>();
  const pending = useRef<(yes: boolean) => void>(undefined);
  const settle = useCallback((yes: boolean) => {
    const resolve = pending.current;
    pending.current = undefined;
    setRequest(undefined);
    resolve?.(yes);
  }, []);
  useEffect(() => () => pending.current?.(false), []);
  const confirm = useCallback((next: ConfirmRequest) => {
    pending.current?.(false);
    setRequest(next);
    return new Promise<boolean>((resolve) => {
      pending.current = resolve;
    });
  }, []);
  const element = request ? <ConfirmDialog {...request} open onConfirm={() => settle(true)} onCancel={() => settle(false)} /> : null;
  return { confirm, element };
}
