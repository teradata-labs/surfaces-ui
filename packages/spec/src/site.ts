import { z } from "zod";
import { basicsCatalog } from "./basics.js";
import { type ComponentDefinition, extendCatalog } from "./catalog.js";
import { action, childId, childList, dynamicString } from "./dynamic.js";
import { safeUrl } from "./functions.js";

/**
 * A link an agent wrote: an http or https address, or a path on this site ("/pricing", never "//elsewhere").
 * Anything else (a script, a data address) is not a link.
 */
export function siteLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return value;
  return safeUrl(value);
}

const str = (about: string) => z.string().describe(about);
const ID = z.string().min(1).max(80);
const LINK = z.string().max(2000).describe("An http or https address, or a path on this site. Anything else is not drawn as a link.");
const LEVEL = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);
const NAV_GROUPS = z
  .array(z.strictObject({ label: z.string().optional(), items: z.array(z.strictObject({ id: ID, label: z.string(), href: LINK.optional() })).min(1).max(30) }))
  .min(1)
  .max(12);
const POST = z.strictObject({
  id: ID,
  title: z.string().min(1),
  date: z.string().optional().describe("An ISO date, 2026-11-21. Shown in the reader's words for it."),
  excerpt: z.string().max(400).optional(),
  tags: z.array(z.string()).max(8).optional(),
  href: LINK.optional(),
});

/**
 * The components a site adds to the basics: a page's opening, its sections, cards, a product shown on devices, a
 * prompt and its answer, named examples, navigation and a footer, images, quotes, notes and posts. Each is drawn by a
 * renderer in `siteRenderers`; none reads data.
 */
const SITE_COMPONENTS = {
  Hero: {
    description:
      "The opening of a page: a large title that scales with the room it has, a lead of one or two sentences, and its actions (Buttons or Links; the first is the primary one) as its children. Use one per page, first; put a Media, DeviceFrame or PromptReveal after it to show the product.",
    props: {
      title: dynamicString,
      lead: dynamicString.optional(),
      eyebrow: dynamicString.optional().describe("A short line above the title: a product name, a release."),
      children: childList.optional().describe("The actions: Buttons or Links, the primary one first. One to three."),
      align: z.enum(["center", "start"]).optional(),
      level: LEVEL.optional().describe("The title's heading level. Defaults to 1; use 2 when the host's page already has a title."),
    },
    example: { id: "hero", component: "Hero", title: "Surfaces UI", lead: "Components for data work that people and agents build together.", children: ["start", "browse"] },
  },
  Section: {
    description: "A part of a page under its own heading, with room around it: one message per section. Its children follow the heading.",
    props: {
      heading: dynamicString,
      eyebrow: dynamicString.optional(),
      lead: dynamicString.optional().describe("A sentence under the heading."),
      children: childList,
      level: LEVEL.optional().describe("The heading's level. Defaults to 2."),
    },
    example: { id: "roles", component: "Section", heading: "Showcase", lead: "Setups for the people who work with data.", children: ["role-cards"] },
  },
  FeatureGrid: {
    description: "Cards of a title and a line each, as many to a row as fit. An item with `href` is a link; one without sends `select` with its `id`.",
    props: {
      label: z.string().optional().describe("What the cards are, for assistive technology."),
      items: z.array(z.strictObject({ id: ID, title: z.string().min(1), line: z.string().max(200).optional(), href: LINK.optional() })).min(1).max(24),
      action: action.optional(),
    },
    example: {
      id: "role-cards",
      component: "FeatureGrid",
      label: "Roles",
      items: [
        { id: "analyst", title: "Analyst", line: "Ask, chart and share." },
        { id: "engineer", title: "Analytics engineer", line: "Model the data once." },
      ],
      action: { event: { name: "select" } },
    },
  },
  DeviceFrame: {
    description:
      "The same content on a desktop window and a phone, side by side, to show a product. The child is drawn once in each, and stays live. With too little room only the last device stands.",
    props: {
      child: childId,
      devices: z.array(z.enum(["desktop", "phone"])).min(1).max(2).optional().describe("Which, in order. Defaults to both."),
      title: z.string().max(80).optional().describe("The desktop window's title."),
      label: z.string().max(200).optional().describe("What the screens show, for assistive technology."),
    },
    example: { id: "devices", component: "DeviceFrame", title: "Playground", label: "a dashboard", child: "screen" },
  },
  PromptReveal: {
    description:
      "A prompt typed out, then its answer shown, and again: for showing what an agent does. It has a Pause button, stops once a person reaches into the answer, and shows the answer finished to anyone who asks for less motion.",
    props: {
      prompt: dynamicString,
      child: childId.describe("The answer: often a DeviceFrame."),
      loop: z.boolean().optional().describe("Starts again after a pause. Defaults to true."),
      label: z.string().max(120).optional().describe("What the answer is, for the status line."),
    },
    example: { id: "demo", component: "PromptReveal", prompt: "Build me a dashboard of this quarter's revenue.", child: "devices" },
  },
  Showcase: {
    description: "A picker of named examples above a stage that shows the chosen one. Use it for a few alternatives of the same kind: roles, plans, themes.",
    props: {
      label: z.string().describe("What the picker chooses between, for assistive technology."),
      examples: z.array(z.strictObject({ id: ID, name: z.string().min(1).max(40), line: z.string().max(200).optional(), child: childId })).min(1).max(12),
      selected: z.string().optional().describe("The id shown first. A person's choice comes back as `selected`."),
    },
    example: {
      id: "roles-showcase",
      component: "Showcase",
      label: "Who it is for",
      examples: [
        { id: "analyst", name: "Analyst", line: "Ask, chart and share.", child: "analyst-view" },
        { id: "steward", name: "Data steward", line: "Keeps data right.", child: "steward-view" },
      ],
    },
  },
  NavBar: {
    description:
      "Navigation across the top of a site: sections on a bar that stays in view, the current section's pages in a second bar beneath, folding into a menu on a phone. An item with `href` is a link; one without sends `select` with its `id`. Bind `current` to mark the page showing.",
    props: {
      label: z.string().describe("The site's name, for assistive technology."),
      brand: z.string().max(60).optional().describe("The site's name, shown at the bar's start."),
      groups: NAV_GROUPS,
      current: dynamicString.optional(),
      action: action.optional(),
    },
    example: {
      id: "site-nav",
      component: "NavBar",
      label: "Surfaces UI",
      brand: "Surfaces UI",
      groups: [
        { label: "Build", items: [{ id: "playground", label: "Playground" }, { id: "chat", label: "Chat" }] },
        { label: "Docs", items: [{ id: "start", label: "Getting started" }] },
      ],
      current: "playground",
      action: { event: { name: "select" } },
    },
  },
  Footer: {
    description: "The end of a page: columns of links and a note (a licence, a copyright). An item with `href` is a link; one without sends `select` with its `id`.",
    props: {
      groups: NAV_GROUPS,
      note: dynamicString.optional(),
      label: z.string().optional().describe("What the links are, for assistive technology. Defaults to \"Site\"."),
      action: action.optional(),
    },
    example: {
      id: "footer",
      component: "Footer",
      groups: [{ label: "Docs", items: [{ id: "start", label: "Getting started" }, { id: "github", label: "GitHub", href: "https://github.com/teradata-labs/surfaces-ui" }] }],
      note: "Apache-2.0",
    },
  },
  Media: {
    description:
      "An image or a video at a fixed ratio, loaded only near the screen; a video never plays on its own. `src` is a name or an address the page knows: the page decides what may load, and with nothing it allows, the description is shown in its place. Always describe what it shows in `alt` (an empty string only for decoration).",
    props: {
      src: z.string().max(2000).describe("A name the page gives an address for, or an address from an origin the page allows."),
      alt: z.string().max(400),
      kind: z.enum(["image", "video"]).optional(),
      ratio: z.enum(["16:9", "4:3", "3:2", "1:1", "21:9"]).optional(),
      caption: dynamicString.optional(),
    },
    example: { id: "shot", component: "Media", src: "dashboard", alt: "A dashboard of revenue by region, drawn by an agent", ratio: "16:9", caption: "Drawn from one sentence." },
  },
  Quote: {
    description: "A pull quote and who said it.",
    props: { text: dynamicString, cite: dynamicString.optional().describe("Who said it."), url: LINK.optional().describe("Where it was said.") },
    example: { id: "quote", component: "Quote", text: "The dashboard was there before I finished my coffee.", cite: "An analyst" },
  },
  Callout: {
    description: "A note set apart from the text around it: a note, a tip or a warning. Its kind is its heading, so it is never told by colour alone. The text is Markdown.",
    props: { tone: z.enum(["note", "tip", "warning"]).optional(), title: dynamicString.optional(), text: dynamicString },
    example: { id: "careful", component: "Callout", tone: "warning", text: "A full refresh **rebuilds every table**. Run it outside working hours." },
  },
  PostCard: {
    description: "One post: its title (a link with `href`, otherwise it sends `open` with its `id`), date, a line of it and its tags.",
    props: { ...POST.shape, level: LEVEL.optional().describe("The title's heading level. Defaults to 3."), action: action.optional() },
    example: { id: "post", component: "PostCard", title: "Charts that tell the truth", date: "2026-11-01", excerpt: "Start bars at zero, and other rules worth keeping.", tags: ["design"], href: "https://example.com/charts" },
  },
  PostList: {
    description: "Posts as cards, in the order given (newest first is usual). Says so when there are none. An item without `href` sends `open` with its `id`.",
    props: { label: z.string().optional(), posts: z.array(POST).max(50), action: action.optional() },
    example: {
      id: "posts",
      component: "PostList",
      label: "Essays",
      posts: [
        { id: "charts", title: "Charts that tell the truth", date: "2026-11-01", tags: ["design"] },
        { id: "models", title: "One meaning for a metric", date: "2026-10-12", tags: ["modelling"] },
      ],
      action: { event: { name: "open" } },
    },
  },
} satisfies Record<string, ComponentDefinition>;

const EVENTS = {
  FeatureGrid: { select: { description: "When a card without a link is chosen.", context: { id: str("the item's id") } } },
  NavBar: { select: { description: "When an item without a link is chosen.", context: { id: str("the item's id") } } },
  Footer: { select: { description: "When a link without an address is chosen.", context: { id: str("the item's id") } } },
  PostCard: { open: { description: "When a post without a link is opened.", context: { id: str("the post's id") } } },
  PostList: { open: { description: "When a post without a link is opened.", context: { id: str("the post's id") } } },
};

/** The names of the components a site adds to the basics, in catalog order. */
export const SITE_COMPONENT_NAMES = Object.keys(SITE_COMPONENTS) as (keyof typeof SITE_COMPONENTS)[];

/**
 * The site catalog: the basics (layout, text, links, buttons, forms, navigation, the theme switch) and the
 * components a site adds. It has no data components, so an agent building a page for people to read is not offered
 * a PivotTable, and a data agent is not offered a Hero.
 */
export const siteCatalog = extendCatalog(basicsCatalog, {
  id: "urn:surfaces:catalog:site:v1",
  title: "Surfaces site",
  description: "Pages for people to read: landing pages, docs and posts. The basic components, plus heroes, sections, cards, devices, navigation, footers, media, quotes, callouts and posts.",
  components: Object.fromEntries(
    Object.entries<ComponentDefinition>(SITE_COMPONENTS).map(([name, definition]) => {
      const events = (EVENTS as Record<string, ComponentDefinition["events"]>)[name];
      return [name, events ? { ...definition, events } : definition];
    }),
  ) as Record<keyof typeof SITE_COMPONENTS, ComponentDefinition>,
});
