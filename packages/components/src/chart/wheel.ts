/**
 * Lets the wheel scroll the page over a chart or graph drawn with ECharts,
 * whose own zoom would otherwise take every wheel event and trap the page.
 *
 * The rule is the one pan-zoom diagrams follow: Ctrl/⌘ + wheel, or a pinch
 * (which the browser reports as Ctrl + wheel), zooms; a plain wheel scrolls
 * the page. A plain wheel event is stopped on its way down, before ECharts
 * sees it, and its default (the page scrolling) is left alone.
 *
 * Returns the function that takes the rule away.
 */
export function wheelScrollsThePage(element: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
  };
  element.addEventListener("wheel", onWheel, { capture: true });
  return () => element.removeEventListener("wheel", onWheel, { capture: true });
}
