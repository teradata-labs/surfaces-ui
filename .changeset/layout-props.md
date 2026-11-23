---
"@surfaces-ui/spec": minor
"@surfaces-ui/components": minor
"@surfaces-ui/chat": minor
---

Layout props for the basic containers, so a page can be laid out like frames with auto layout while staying on the theme's spacing:

- `gap` on Row, Column and Grid, and `padding` on Row, Column and Card: a step of the spacing scale, `"none" | 1 | 2 | 3 | 4 | 6 | 8` (`--sf-space-<step>`). Gap defaults to 4; padding to "none", and to 4 on a Card.
- `wrap` on Row (default true): false keeps the children on one line, even in a narrow container.
- `sizes` on Row: one per child, `"hug"`, `"fill"` or `{ fixed: px }` (24 to 1600). It wins over `widths` when both have one entry per child; with neither, the children share the width as before. Resizing a Row's children by hand gives them `widths` and takes `sizes` off.
- A page that uses none of them is drawn exactly as before: the props add `data-gap`, `data-padding`, `data-wrap` and `data-sizes` only when they are set.
- `spaceStep`, `spaceVar`, `spaceName`, `nextSpaceStep`, `rowSizes`, `spaceMessages`, `spaceProps` and `spaceDefault` read and set them.

Arrange (`useArrange`): a drag shows a line in the gap where the component will land and outlines the container that takes it, in place of a shadow on the neighbour. Clicking a frame, or reaching its bar by keyboard, selects it (`selected`, `select`, and the `selected` and `onSelect` options for a host with its own selection); a selected Row, Column or Grid shows a handle in its gap and at its padding (a Card at its padding) that drags, or steps by arrow key, from one token to the next, labelled "16 px · space-4", and sends the change through `apply` like any other arrangement. The root is wrapped in `.sf-arrange-root` while arranging so it can be selected and outlined.

Icons: `bell` and `person` for a workspace's rail (and the Workspace panel `icon` enum, which now also lists `people`); `more` and `bell` for ChatIcon, so `<MenuButton iconOnly icon="more" label="More for …">` is an overflow menu.
