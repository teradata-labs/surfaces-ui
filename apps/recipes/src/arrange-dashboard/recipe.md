# A dashboard a person can arrange

Any page drawn from a `PageDocument` can offer Arrange: a person drags a component by its bar to before or after another, to either side of one to put the two side by side, or onto the end of a container; drags the handle under it to change its height, or at its right edge to change widths. Every drag has a keyboard form (the bar's arrows, arrow keys on the handles), and drags use pointer events, so they work by touch and pen.

Arranging is an option, never a dependency. The page draws the same with it off, and what Arrange sends is the same JSON an agent sends to arrange a page: the order of `children`, `widths` on a `Grid` or `Row`, and `height` or `minHeight`. So a page arranged by hand can be changed by an agent afterwards, and the other way round.

How it works:

- `useArrange` from `@surfaces-ui/spec/react` takes the surface and three functions: `apply` (A2UI messages to take in as one step), `say` (what happened, or why it could not be done) and `remove`.
- `apply` turns the messages into page edits with `editsFromMessages` and applies them with `editPage`, which checks each against the catalog. A move between containers arrives as two components; the edits keep the component that moved.
- While arranging, pass `arrange.frame` to `SurfaceView` and draw `arrange.shown(surface)`, so a size being dragged is drawn as it will be. Put `arrange.region` on the element around the surface: it quiets the components' own controls so only one layer shows.
- `ArrangeToggle`, `ArrangeHelp` and `ArrangeGhost` are the button, the help and status line, and the chip that follows the pointer.

`PageStudio` from `@surfaces-ui/chat` does all of this with `arrange`, logs each arrangement by the person who made it, and tells the agent about it with the next instruction. Use this recipe when the page is not in a studio: a saved dashboard, a report, or any multi-view page of your own.

{{file: ArrangeableDashboard.tsx}}

The test draws a real page against `memoryDataSource`, moves a number earlier with its control, removes the title, and undoes the removal. Pointer drags and the resize handles are covered by the playground's browser tests, since jsdom has no layout.

{{file: arrange.test.tsx}}
