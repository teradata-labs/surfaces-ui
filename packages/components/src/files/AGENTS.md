# `packages/components/src/files`

Agent notes for this folder. The rules that hold everywhere are in the root [AGENTS.md](../../../../AGENTS.md), and the rules every component follows are in [packages/components/AGENTS.md](../../AGENTS.md). What you learn about this folder goes here.

| Component | Use it for | Key props |
|---|---|---|
| `FileBrowser` | A tree of folders and files: a source's storage (only where it may read) and folders a person opens from their own computer; sizes, dates, what a file can be read as and which table reads it; select several and hand them to a chat | `sourceId`, `sourceLabel`, `places` (`FilePlace[]`), `local`, `onOpen`, `onSelect`, `onAttach` / `attachLabel`, `renderActions`, `height` (helpers: `sourceFiles`, `localFilesPlace`, `directoryPlace`, `pickDirectory`, `fileRef`, `fileSize`, `fileFormatByName`) |

## Rules

- **`FileBrowser` lists names, never contents.** It depends on `FilePlace` (`list(path, page)`) alone. A source's storage comes through `DataSource.listFiles` (optional; a backend without it leaves it out and the browser says so), which lists only the places the source may read: the DuckDB engine gives the folders of its registered tables and its connections' scopes, reads a local folder from disk after resolving where it really is (`..` and links cannot leave the roots), and lists an object store by prefix up to 5,000 entries, grouped by the next path part, with no sizes or dates (run against an S3 stand-in, not a real store). A folder from the person's computer is read by their browser (`showDirectoryPicker` where there is one, a folder input otherwise), hidden files are left out, and nothing is uploaded; its paths start at the folder opened, never above it. A file is handed on as a `DataRef` of kind `file` (`path`, with `sourceId` the source or `local:<folder>`), which `turnText` writes for a model, saying of a local file that it cannot be read. Opening a file is the host's decision (`onOpen`); the component loads nothing. Rows are windowed and folders load a page at a time.
