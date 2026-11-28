# surfaces-analytics

Data and analytics work with [Surfaces UI](https://surfaces-ui.com): the judgment an agent needs to chart, clean, model and present data well, and a server that draws live tables, charts and dashboards over your own data inside the conversation.

It is for anyone working with data through an agent, not only for people building an app: an analyst asking a question of a warehouse, an analytics engineer reviewing a transformation, a data steward deciding how a column of personal data is treated, a designer checking a dashboard, a developer putting Surfaces UI components into a product.

## What is in it

| Skill | Use it when |
|---|---|
| `chart-standards` | Drawing, choosing or reviewing a chart, sparkline or headline number, after Edward Tufte and Stephen Few |
| `dashboard-design` | Laying out a dashboard or report so it can be read at a glance |
| `human-in-the-loop` | Anything that changes data, or a decision a person must make, with an approval they can read and edit |
| `connect-and-onboard` | Connecting a source and getting to know a dataset |
| `data-cleaning` | Finding and fixing data problems, as a plan a person reviews |
| `personal-data` | Reviewing columns for personal data and choosing a treatment for each |
| `data-transformations` | Writing and reviewing transformations and pipeline datasets |
| `responsive-accessible-ui` | Making a page work on any screen and for everyone, to WCAG 2.2 AA |

The **Surfaces MCP server** gives the agent tools to list and describe tables and to show a data grid, a chart, a pivot table, a query result, a SQL editor, a schema explorer or a whole dashboard. Tools for the model return names, types and descriptions, never rows; the rows a person sees are fetched by the page for the window on screen. Queries are read-only.

## Install

In Claude Code:

```
/plugin marketplace add teradata-labs/surfaces-ui
/plugin install surfaces-analytics@surfaces-ui
```

In another agent:

- **Skills.** Each folder under `skills/` is a standard Agent Skill (`SKILL.md` with `name` and `description`). Copy the ones you want into your agent's skills folder.
- **MCP server.** Add it to any MCP client as a local server: command `npx`, arguments `-y @surfaces-ui/mcp`. In a repository, `npx surfaces-mcp install --dir .` writes that into `.mcp.json` for you.

## Try it

- "What tables are in the sample data? Show me revenue by month as a chart."
- "Review this dashboard against the chart standards and tell me what to fix."
- "This customers table has emails and birth dates. Walk me through a personal data review before we share it."

## Where it works

| Where | Skills | Interactive views and your data |
|---|---|---|
| Claude Code, and the Code tab of the Claude desktop app | Yes | Yes. You are asked for the settings below when you install. |
| Cowork in the desktop app, in a session that runs on your computer | Yes | Yes, with the sample data. Cowork does not ask for settings, so for your own data keep a config in the `.surfaces` folder of your home directory (see below). |
| Chat (desktop, web and mobile) | Yes | Not from this plugin: a chat does not start a plugin's local server. In the desktop app you can add the server yourself, under Settings, Developer, Edit Config (see below). |

This follows Anthropic's published table of what each app loads from a plugin. The plugin has been installed and run in Claude Code; it has not yet been tried in Cowork or in a desktop chat.

## Your own data

With no configuration the server serves six synthetic sample datasets (retail, healthcare, fraud, telco, transportation, manufacturing), so everything works straight after install. To use your own data, put a `surfaces.config.ts` in the project you open, naming your sources: Parquet, CSV or JSON files, Delta and Iceberg tables, a Postgres database, Teradata or DataFusion. The `connect-and-onboard` skill walks through it. Credentials are named in the config and read from the environment or a git-ignored `.env.local` beside it; they are never written into the config or shown to the model.

### A database that has its own MCP server

If your database is reached through an MCP server of its own (the Teradata MCP server, or a Postgres, MySQL or DuckDB one), this plugin's server connects to that server and sends its SQL through it, so charts and tables are drawn from your database and its rows never pass through the model. Fill in the plugin's settings:

| Setting | What to enter |
|---|---|
| Database type | `teradata`, `postgres`, `mysql` or `duckdb` |
| The database's MCP server | How it is started on this computer, such as `uvx teradata-mcp-server`, or its `https://` address |
| Connection string or token | What that server needs to sign in. It is kept in your computer's credential store and handed only to that server. |
| Name the connection string is passed under | `DATABASE_URI` unless your server reads another name |

Left as they are, the settings give you the sample data.

### With no project folder

The server looks for `surfaces.config.ts` (or `.mjs`) in the folder it is started in, and then in `.surfaces` in your home directory. Put a config there, with a `.env.local` beside it for the connection string, to use your own data where there is no project and no settings screen.

### In a desktop chat

Add the server under Settings, Developer, Edit Config, with the same four values as environment variables:

```json
{ "mcpServers": { "surfaces": {
  "command": "npx", "args": ["-y", "@surfaces-ui/mcp"],
  "env": { "SURFACES_SOURCE_DIALECT": "teradata", "SURFACES_SOURCE_SERVER": "uvx teradata-mcp-server", "SURFACES_SOURCE_SECRET": "your connection string" } } } }
```

That file is plain text on your computer, so anyone who can read it can read the connection string; the `.surfaces` folder with a `.env.local` keeps it out of that file.

## What it runs, reads and sends

- **Skills** are text. They run nothing.
- **The MCP server** is started on your machine by `npx -y @surfaces-ui/mcp@<version>`, pinned to one exact version of the [`@surfaces-ui/mcp`](https://www.npmjs.com/package/@surfaces-ui/mcp) package. The first start downloads that package and its dependencies from the npm registry; Node 22 or later is needed. It reads `surfaces.config.ts` and `.env.local` in the project folder or in `.surfaces` in your home directory, and connects only to the data sources that config or the plugin's settings name. When a setting names a database's MCP server, it starts that server (or calls its address) and hands it the connection string you entered, and nothing else of your environment. It sends nothing to Anthropic or to the plugin's authors, and has no telemetry. Table names, column names, types and descriptions go to the model through the tools you see it call; row values do not, unless you ask the agent to read them some other way.
- There are no hooks.

## Support

Questions and problems: https://github.com/teradata-labs/surfaces-ui/issues. Guides: https://surfaces-ui.com.

Apache License 2.0.
