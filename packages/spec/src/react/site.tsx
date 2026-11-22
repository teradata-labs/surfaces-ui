import { Callout, DeviceFrame, FeatureGrid, Footer, Hero, Markdown, Media, type MediaRatio, NavBar, PostCard, PostList, PromptReveal, Quote, Section, Showcase } from "@surfaces-ui/components";
import { type ReactNode, createContext, useContext } from "react";
import { safeUrl } from "../functions.js";
import type { ComponentRenderer } from "./Surface.js";
import { basicsRenderers } from "./renderers.js";

const text = (value: unknown): string => (value == null || typeof value === "object" ? "" : String(value));
const optional = (value: unknown): string | undefined => text(value) || undefined;
const level = (value: unknown) => (value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined);

/**
 * A link an agent wrote: an http or https address, or a path on this site ("/pricing", never "//elsewhere").
 * Anything else (a script, a data address) is not a link.
 */
export function siteLink(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (/^\/(?!\/)[^\s\\]*$/.test(value)) return value;
  return safeUrl(value);
}

/** Where images and videos may come from. The page decides; an agent only names them. */
export interface MediaPolicy {
  /** The address for a name an agent used ("dashboard"), or nothing. Asked first. */
  resolve?(src: string): string | undefined;
  /** Origins an address may come from as written ("https://images.example.com"). Without any, none may. */
  origins?: string[];
}

const MediaPolicyContext = createContext<MediaPolicy>({});

/**
 * Says where a site surface's images and videos may load from. With none, an agent's Media shows its description
 * in its place: a page never loads an address an agent chose on its own, which could tell another site who is
 * reading or show anything at all.
 */
export function MediaPolicyProvider({ policy, children }: { policy: MediaPolicy; children: ReactNode }) {
  return <MediaPolicyContext.Provider value={policy}>{children}</MediaPolicyContext.Provider>;
}

/** The address a Media may load under a policy, or nothing. */
export function mediaAddress(src: unknown, policy: MediaPolicy): string | undefined {
  if (typeof src !== "string" || !src) return undefined;
  const named = policy.resolve?.(src);
  if (named) return siteLink(named);
  const address = safeUrl(src);
  if (!address) return undefined;
  const origin = new URL(address).origin;
  return policy.origins?.some((allowed) => safeUrl(allowed) && new URL(allowed).origin === origin) ? address : undefined;
}

type NavItem = { id: string; label: string; href?: string };
type NavGroup = { label?: string; items: NavItem[] };

/** Groups with every link an agent wrote checked, and the ids of the items that are not links. */
function navGroups(value: unknown): NavGroup[] {
  return ((value as NavGroup[]) ?? []).map((group) => ({
    ...(group.label ? { label: group.label } : {}),
    items: (group.items ?? []).map((item) => {
      const href = siteLink(item.href);
      return { id: item.id, label: item.label, ...(href ? { href } : {}) };
    }),
  }));
}

const isLink = (groups: NavGroup[], id: string) => groups.some((group) => group.items.some((item) => item.id === id && item.href));

function MediaView({ props }: { props: Record<string, unknown> }) {
  const policy = useContext(MediaPolicyContext);
  return (
    <Media
      src={mediaAddress(props.src, policy)}
      alt={text(props.alt)}
      kind={props.kind === "video" ? "video" : "image"}
      ratio={(optional(props.ratio) as MediaRatio | undefined) ?? "16:9"}
      caption={optional(props.caption)}
    />
  );
}

/** The renderers of the components a site adds to the basics. */
export const siteComponentRenderers: Record<string, ComponentRenderer> = {
  Hero: ({ props, component, children }) => (
    <Hero
      title={text(props.title)}
      lead={optional(props.lead)}
      eyebrow={optional(props.eyebrow)}
      actions={Array.isArray(component.children) && component.children.length > 0 ? children(component.children) : undefined}
      align={props.align === "start" ? "start" : "center"}
      level={level(props.level)}
    />
  ),
  Section: ({ props, component, children }) => (
    <Section heading={text(props.heading)} eyebrow={optional(props.eyebrow)} lead={optional(props.lead)} level={level(props.level)}>
      {children(component.children)}
    </Section>
  ),
  FeatureGrid: ({ props, component, dispatch }) => {
    const items = ((props.items as { id: string; title: string; line?: string; href?: string }[]) ?? []).map((item) => {
      const href = siteLink(item.href);
      return { id: item.id, title: item.title, ...(item.line ? { line: item.line } : {}), ...(href ? { href } : {}) };
    });
    return <FeatureGrid label={optional(props.label)} items={items} onSelect={component.action ? (id) => dispatch(component.action, { id }) : undefined} />;
  },
  DeviceFrame: ({ props, component, child }) => (
    <DeviceFrame devices={Array.isArray(props.devices) ? (props.devices as ("desktop" | "phone")[]) : undefined} title={optional(props.title)} label={optional(props.label)}>
      {() => child(component.child)}
    </DeviceFrame>
  ),
  PromptReveal: ({ props, component, child }) => (
    <PromptReveal prompt={text(props.prompt)} loop={props.loop !== false} label={optional(props.label)}>
      {child(component.child)}
    </PromptReveal>
  ),
  Showcase: ({ props, child, reportControls }) => {
    const items = ((props.examples as { id: string; name: string; line?: string; child: string }[]) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      ...(item.line ? { line: item.line } : {}),
      content: child(item.child),
    }));
    return <Showcase label={text(props.label) || "Examples"} items={items} defaultValue={optional(props.selected)} onChange={(selected) => reportControls({ selected })} />;
  },
  NavBar: ({ props, component, dispatch }) => {
    const groups = navGroups(props.groups);
    return (
      <NavBar
        label={text(props.label) || "Site"}
        brand={optional(props.brand)}
        groups={groups}
        current={optional(props.current)}
        onSelect={(id) => {
          if (!isLink(groups, id)) dispatch(component.action, { id });
        }}
      />
    );
  },
  Footer: ({ props, component, dispatch }) => {
    const groups = navGroups(props.groups);
    return <Footer groups={groups} note={optional(props.note)} label={optional(props.label)} onSelect={component.action ? (id) => dispatch(component.action, { id }) : undefined} />;
  },
  Media: ({ props }) => <MediaView props={props} />,
  Quote: ({ props }) => (
    <Quote cite={optional(props.cite)} href={siteLink(props.url)}>
      {text(props.text)}
    </Quote>
  ),
  Callout: ({ props }) => (
    <Callout tone={props.tone === "tip" || props.tone === "warning" ? props.tone : "note"} title={optional(props.title)}>
      <Markdown text={text(props.text)} />
    </Callout>
  ),
  PostCard: ({ props, component, dispatch }) => (
    <PostCard
      id={text(props.id)}
      title={text(props.title)}
      date={optional(props.date)}
      excerpt={optional(props.excerpt)}
      tags={Array.isArray(props.tags) ? (props.tags as string[]) : undefined}
      href={siteLink(props.href)}
      level={level(props.level)}
      onOpen={component.action ? (id) => dispatch(component.action, { id }) : undefined}
    />
  ),
  PostList: ({ props, component, dispatch }) => {
    const posts = ((props.posts as { id: string; title: string; date?: string; excerpt?: string; tags?: string[]; href?: string }[]) ?? []).map((post) => {
      const href = siteLink(post.href);
      const { href: _given, ...rest } = post;
      return { ...rest, ...(href ? { href } : {}) };
    });
    return <PostList label={optional(props.label)} posts={posts} onOpen={component.action ? (id) => dispatch(component.action, { id }) : undefined} />;
  },
};

/** Everything the site catalog draws: the basics and the components a site adds. */
export const siteRenderers: Record<string, ComponentRenderer> = { ...basicsRenderers, ...siteComponentRenderers };
