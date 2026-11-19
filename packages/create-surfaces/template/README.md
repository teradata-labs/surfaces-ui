# __TITLE__

A Surfaces UI app: a dashboard over sample retail data, and a chat whose agent draws live charts and tables.

```bash
npm install
npm run serve     # data server on http://localhost:5220, with six sample datasets
npm run dev       # the app on http://localhost:5173
```

For the chat, set `ANTHROPIC_API_KEY` in the server's environment before `npm run serve`. The agent runs on the server; the key never reaches the browser. Without it, the chat says no agent is set up.

- `src/dashboard.ts`: the dashboard, as a document of catalog components. Change it, or let an agent write one.
- `surfaces.config.ts`: data sources and the agent. Add your own sources here (see the Surfaces UI getting-started guide).
- The chat is kept in this browser across reloads, including approvals still waiting.
- Dev tools: the button at the corner of the page, or Ctrl+Shift+D, shows what the agent sent and what the page did with it, with time travel. They are on while developing and absent from a production build (`src/main.tsx`).
