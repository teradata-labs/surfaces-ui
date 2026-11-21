import { type PageDocument, analyticsCatalog, editPage, editsFromMessages, pageSurface, removeComponentMessages } from "@surfaces-ui/spec";
import { ArrangeGhost, ArrangeHelp, ArrangeToggle, SurfaceView, analyticsRenderers, useArrange } from "@surfaces-ui/spec/react";
import { useMemo, useState } from "react";

/**
 * A saved dashboard (a `PageDocument`) a person can rearrange by hand.
 * Arranging is optional: the page draws the same with it off, and an agent
 * arranges the same page by sending the same props (`children`, `widths`,
 * `height`). Every change is one step to undo.
 */
export function ArrangeableDashboard({ initial, onChange }: { initial: PageDocument; onChange?(page: PageDocument): void }) {
  const [history, setHistory] = useState<PageDocument[]>([initial]);
  const page = history.at(-1)!;
  const [status, setStatus] = useState<{ text: string; error?: boolean }>();
  const surface = useMemo(() => pageSurface(page), [page]);

  /** Takes in what Arrange sends, as page edits the catalog checks, and keeps it as one step. */
  const apply = (messages: Parameters<typeof editsFromMessages>[1]) => {
    const { page: next, rejected } = editPage(page, editsFromMessages(page, messages), analyticsCatalog);
    if (rejected.length > 0) return setStatus({ text: rejected[0]!.reason, error: true });
    setHistory((steps) => [...steps, next]);
    onChange?.(next);
  };

  const arrange = useArrange({
    surface,
    apply,
    say: setStatus,
    remove: (id) => {
      const result = removeComponentMessages(surface, id);
      if ("error" in result) setStatus({ text: result.error, error: true });
      else apply(result.messages);
    },
    // Widths and set heights can be dragged without turning Arrange on; moving and removing still need it.
    resizeWhileViewing: true,
  });

  return (
    <section aria-label={page.title}>
      <div>
        <ArrangeToggle arrange={arrange} />
        <button type="button" className="sf-button" disabled={history.length === 1} onClick={() => setHistory((steps) => steps.slice(0, -1))}>
          Undo
        </button>
      </div>
      <ArrangeHelp arrange={arrange} status={status} />
      <div {...arrange.region} className={`sf-container ${arrange.region.className}`}>
        <SurfaceView
          surface={arrange.shown(surface)}
          catalog={analyticsCatalog}
          renderers={analyticsRenderers}
          {...(arrange.surfaceFrame ? { frame: arrange.surfaceFrame } : {})}
        />
      </div>
      <ArrangeGhost arrange={arrange} />
    </section>
  );
}
