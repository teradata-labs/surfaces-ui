# Surfaces UI: a five-minute walkthrough

- **Audience:** developers deciding whether to adopt the library.
- **Voice:** Jamie (Premium, en-GB, macOS), warm and conversational.
- **Length:** about 705 words. Jamie reads it in about 4:10 (4:17 with the gaps between scenes); the pauses for on-screen actions bring the video to about 5:00.
- **Recording:** in the playground at http://localhost:5210, in the Midnight theme, dark mode, with the dev server running. Recording waits until the composer agent work has landed.

Each scene gives what is on screen, then what Jamie says.

---

## 1. The problem (0:00–0:35)

**On screen:** the playground home. The cursor rests on the dataset picker, which is set to Retail.

> Every data team ends up building the same things. A grid that can handle millions of rows. Charts that don't lie. A catalog page, a relationship diagram, a pipeline view. And now there's a new user of all of it: an agent, which needs to draw that same UI in a chat, a side panel, or inside Claude Desktop.
>
> Surfaces UI is a React library for exactly that. Let me show you around. Everything here runs on one sample dataset, and when I switch it, every page follows.

**Action:** switch the picker from Retail to Healthcare, then back to Retail.

## 2. Finding data (0:35–1:15)

**On screen:** the Data catalog. Type "customer" in search, open `orders`, scroll to Related.

> This is the catalog, built from the discovery components. Search works by name or by meaning. Opening a table shows its columns, how full they are, and what they join to.
>
> Notice the labels. Joins the source declares say "Declared". Guesses from matching column names say "Inferred". And data values stay hidden unless you allow them for a source, so nothing private ends up in an index or a prompt by accident.

**Action:** press "Save as surface", then open it in the library and click a related table.

> I can save this whole page as a surface: a small JSON document. It still works on its own, so clicking a table opens it right there.

## 3. The model and the pipelines (1:15–1:50)

**On screen:** the Data model page. Zoom in with the wheel, pan by dragging, then press "Fit". Switch to Pipelines.

> Here's the relationship diagram. Drag one column onto another to make a join, and it refuses joins that can't work. It pans and zooms, and every action also has a button or a key, so it works without a mouse.
>
> Pipelines draw the same way: datasets, their data-quality rules, and runs. The server defines what a pipeline runs. The browser can only press go.

## 4. Chat, with a person in charge (1:50–3:05)

**On screen:** Chat. Press a starter for a chart. The reply draws a live chart. Then press the archive starter, and the approval card appears.

> Now the agent side. A chat reply here isn't a picture of a chart. It's the real component, querying real data, and every message the agent sends is checked against a catalog first. Anything not in the catalog simply isn't drawn.
>
> Each component also declares the events it sends back, and what they carry. A decision card sends the choice, and a SQL proposal sends the SQL. If an agent says what it expects and an event doesn't match, it's refused before it leaves the page. And when a person changes a filter or a sort by hand, the agent sees that on its next turn.
>
> When an agent wants to do something that changes data, the turn pauses. A person sees exactly what will run, can edit it, gives a reason, and types "confirm". The server checks that answer before anything happens, and a receipt shows what ran.

**Action:** fill in a reason, type "confirm", allow it, and show the receipt.

## 5. Dashboards in plain language (3:05–4:05)

**On screen:** Pages. Pick the overview and type "add a chart of revenue by month". Then open the cross-filter dashboard and click a bar.

> Pages are documents too. Ask for a change in plain words and the agent edits the page. Each instruction is one undo step, and the log says who made it.
>
> This one is built by hand in React. Click a bar and every other view filters. The filter lives in the address bar, so you can share the link. And the filtering happens in the database, never in the browser.
>
> The charts follow Tufte and Few. Bars start at zero, there's only ever one scale, and categories are sorted largest first. If a chart's shape would mislead, it says so right underneath. Headline numbers come with a trend beside them, so a total never stands alone, and every chart has a table and a text reading too.

## 6. Composing with an agent (4:05–4:45)

**On screen:**
- The Composer. In the right-hand panel, pick an agent and type an instruction.
- The new messages appear in the stepper and the preview updates.
- Open the Data model tab, then the History tab.
- Save to the library, then open Hosts.

> The composer is where you build surfaces with an agent beside you. It can be Claude, OpenAI, a local model through Ollama, or Loom. Keys stay on the server.
>
> The agent replies in A2UI messages, and you can step through them one at a time. The tabs show the data model as you type into the surface, and a history of every turn and event.
>
> Save it to the library and it's versioned. Here's that same surface in four places at once: a page, a chat reply, a narrow side panel, and the MCP app that runs inside Claude Desktop.

## 7. Under the hood, and your next step (4:45–5:15)

**On screen:** the Theme editor briefly, then the playground home.

> Under all of this is one small interface, DataSource. Use the DuckDB, DataFusion or Teradata engines, or write your own. Queries are read-only, and sorting, filtering and paging happen in SQL. Themes are tokens, so contrast is tested in every preset.
>
> The quickest way in is the playground. Clone the repo, run pnpm install and pnpm dev, pick a dataset, and start poking at it. Thanks for watching.
