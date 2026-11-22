import { DeviceFrame } from "@surfaces-ui/components";
import type { PageDocument } from "@surfaces-ui/spec";
import { analyticsCatalog, pageSurface } from "@surfaces-ui/spec";
import { SurfaceView, lazyAnalyticsRenderers } from "@surfaces-ui/spec/react";
import { type CSSProperties, useMemo } from "react";

/**
 * One surface drawn live: the real components, over the picked data, to click, filter, sort and scroll. Each part
 * rises in as it is first drawn, one after another; the delays are motion tokens, so under reduced motion they are
 * nothing and the page is simply there.
 */
export function Screen({ page }: { page: PageDocument }) {
  const surface = useMemo(() => pageSurface(page), [page]);
  const order = useMemo(() => new Map(page.components.map((c, index) => [c.id, index])), [page]);
  return (
    <SurfaceView
      surface={surface}
      catalog={analyticsCatalog}
      renderers={lazyAnalyticsRenderers}
      frame={(component, drawn) => (
        <div key={component.id} className="home-reveal" style={{ "--home-reveal-step": order.get(component.id) ?? 0 } as CSSProperties}>
          {drawn}
        </div>
      )}
    />
  );
}

/**
 * The same page on a desktop window and on an iPhone, side by side (the library's `DeviceFrame`); with too little
 * room, only the phone. `prompt` is what the person asked, shown above the page on each screen.
 */
export function Devices({ page, prompt, title = "Playground", describe }: { page: PageDocument; prompt?: string; title?: string; describe: string }) {
  return (
    <DeviceFrame title={title} label={describe}>
      {(device) => (
        <div className="home-device-body">
          {prompt && (
            <p className={device === "phone" ? "home-bubble" : "home-prompt"} aria-hidden="true">
              {prompt}
            </p>
          )}
          <Screen page={page} />
        </div>
      )}
    </DeviceFrame>
  );
}
