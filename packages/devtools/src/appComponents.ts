import { type AppComponentDoc, describeAppComponent } from "@surfaces-ui/components/app-components";
import type { SurfacesDevToolsProps } from "./SurfacesDevTools.js";

/*
 * The dev tools as an app component: described once, as data, like the ones in
 * @surfaces-ui/components. The playground draws its page from this and
 * `pnpm docs:gen` writes docs/components.
 */
export const surfacesDevToolsDoc = describeAppComponent<SurfacesDevToolsProps>()({
  name: "SurfacesDevTools",
  from: "@surfaces-ui/devtools",
  description:
    "Developer tools for agent-generated UI. Placed once around an app, it records what the library does inside it with no other wiring: every message in (with its upgrade and what the catalog said), every component drawn, problems, state, events sent out, agent turns and service calls. A small button, and Ctrl+Shift+D, open a panel docked to the bottom or the side, resizable, which can move to a window of its own: a timeline, the raw messages, the component tree, state, events, services, and a scrubber that draws any surface as it stood at an earlier step. On in a development build and absent in production unless `enabled` says otherwise. A trace never holds row values or credentials, and the panel never calls a model.",
  props: {
    type: "object",
    properties: {
      enabled: { type: "boolean", description: "Whether the tools are there at all. Left out: on in a development build, absent in production. Off, the component renders its children and nothing else." },
      limit: { type: "integer", minimum: 1, description: "The most events kept; the oldest are let go first.", default: 2000 },
      defaultOpen: { type: "boolean", description: "Open to begin with." },
      defaultDock: { type: "string", enum: ["bottom", "right"], description: "Which edge the panel docks to to begin with. On a narrow screen it is always the bottom." },
      shortcut: { type: "boolean", description: "Whether Ctrl+Shift+D (⌘⇧D on a Mac) opens and closes the tools.", default: true },
      anchor: { type: "string", enum: ["window", "inline"], description: "\"window\" floats the button over the page's corner and docks the panel to the window; \"inline\" keeps both where the component is placed." },
      performanceTracks: { type: "boolean", description: "Also show spans as custom tracks in the Performance panel of Chrome's developer tools." },
    },
  },
  parts: [
    { prop: "children", label: "The app", description: "Everything inside is traced while the tools are on.", required: true },
    { prop: "recorder", label: "Your own recorder", description: "A recorder from `createRecorder` in @surfaces-ui/trace, to read what is recorded from elsewhere." },
    { prop: "catalog", label: "Your own catalog", description: "The catalog recorded surfaces are drawn with when shown again, with `renderers`. Defaults to the analytics catalog." },
  ],
  callbacks: [{ prop: "onOpenChange", description: "The tools were opened or closed." }],
  example: { enabled: true, defaultOpen: true, anchor: "inline", defaultDock: "bottom" },
});

export const appComponentDocs: AppComponentDoc[] = [surfacesDevToolsDoc];
