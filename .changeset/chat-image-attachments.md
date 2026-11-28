---
"@surfaces-ui/components": minor
"@surfaces-ui/spec": minor
"@surfaces-ui/chat": minor
"@surfaces-ui/datasource-duckdb-wasm": minor
---

Pictures in the chat, and a way to draw them that a model cannot steer:

- The catalog has an `Image` (`src`, required `alt`, `caption`, `width`, `height`, `fit`, `maxHeight`). Its address is drawn only through a host-supplied resolver: `resolveImage` on `SurfaceView`, `MessageList`, `Chat` and `AnalyticsChat`, or an `ImageResolverProvider` (`@surfaces-ui/components`) above them. Without one, or when it returns nothing, the `alt` text is shown. `Markdown` uses the same resolver when it has no `resolveImage` of its own, so a host no longer replaces the catalog's Markdown renderer to draw images. A resolver may return http(s), a `blob:`, a raster `data:image/` or a same-origin path (`safeImageAddress`); the `Image` component is exported too.
- An `AttachResult` can say `attachment` (attached as something other than data, with a thumbnail chip and given to `onSend` as its third argument) or `taken` (handled elsewhere: no chip, no error). A result with neither, and no `ref`, still reads as failed. `ChatAttachment` is a new `attachments` part of a person's message, shown by `MessageList`; `useChat`'s `send` takes it as a third argument. The agent is not sent it.
- `ChatComposer` takes `accept` for the file picker, `uploadDetail` for the menu text, `dropTarget` (an element or a ref) to accept drops on a surrounding panel, `attachments` and `onAttachmentsChange`, and `handleRef` for `attach(files)` and `focus()` (`ComposerHandle`). `Chat` and `AnalyticsChat` pass them on, `Chat` also takes `attachFiles`.
- `@surfaces-ui/datasource-duckdb-wasm`: `registerDuckDbFile(bindings, name, fileOrBytes)` and `dropDuckDbFile` register a `File` (read from disk a piece at a time) or bytes under a name; the engine's `registerFile` and `registerParquet` take a `File`, and `dropFile` removes a table with its file.
