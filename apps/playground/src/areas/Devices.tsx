import type { PageDocument } from "@surfaces-ui/spec";
import { analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { useMemo } from "react";

/**
 * One surface drawn live inside a device's screen: the real components, over the picked data, to click, filter, sort and
 * scroll. The screen scrolls on its own, and can be focused to scroll it by keyboard.
 */
export function Screen({ page, label }: { page: PageDocument; label: string }) {
  const surface = useMemo(() => pageSurface(page), [page]);
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is focused to scroll it by keyboard
    <section className="home-screen sf-container" aria-label={label} tabIndex={0}>
      <SurfaceView
        surface={surface}
        catalog={analyticsCatalog}
        renderers={lazyAnalyticsRenderers}
        frame={(component, drawn) => (
          <div key={component.id} className="home-reveal">
            {drawn}
          </div>
        )}
      />
    </section>
  );
}

/**
 * The same page on a desktop window and on an iPhone, side by side; under 860px only the phone. `prompt` is what the
 * person asked (shown as a field on the desktop and a bubble on the phone), and `typing` adds a caret while it types.
 */
export function Devices({ page, prompt, typing = false, title = "Playground", describe }: { page: PageDocument; prompt: string; typing?: boolean; title?: string; describe: string }) {
  return (
    <div className="home-devices">
      <figure className="home-desktop">
        <div className="home-desktop-bar" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>{title}</p>
        </div>
        <div className="home-desktop-body">
          <div className="home-prompt" aria-hidden="true">
            <span>{prompt}</span>
            {typing && <span className="home-caret" />}
          </div>
          <Screen page={page} label={`Desktop: ${describe}`} />
        </div>
        <figcaption>Desktop</figcaption>
      </figure>
      <figure className="home-phone">
        <div className="home-phone-frame">
          <div className="home-phone-island" aria-hidden="true" />
          <div className="home-phone-body">
            <p className="home-bubble" aria-hidden="true">
              {prompt || " "}
            </p>
            <Screen page={page} label={`iPhone: ${describe}`} />
          </div>
        </div>
        <figcaption>iPhone</figcaption>
      </figure>
    </div>
  );
}
