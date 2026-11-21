import { type CSSProperties, type ReactNode, createElement, useEffect, useId, useState } from "react";

/**
 * Components for sites: a landing page, a docs page, a blog. Each is plain React, styled by `--sf-*` tokens only,
 * and responds to its container. Links are taken as given: an app passes its own addresses, and the catalog's
 * renderers check an agent's with `safeUrl` before they reach here.
 */

type Heading = 1 | 2 | 3 | 4;
const heading = (level: Heading, props: Record<string, unknown>, children: ReactNode) => createElement(`h${level}`, props, children);

export interface HeroProps {
  title: ReactNode;
  /** One or two sentences under the title, at most 40rem wide. */
  lead?: ReactNode;
  /** A short line above the title. */
  eyebrow?: ReactNode;
  /** Buttons or links: the first is the primary action. */
  actions?: ReactNode;
  /** An image, a device frame or a live surface beneath the words. */
  media?: ReactNode;
  align?: "center" | "start";
  /** The title's heading level. Defaults to 1. */
  level?: Heading;
  className?: string;
}

/** The opening of a page: a large title that scales with its container, a lead, actions and media. */
export function Hero({ title, lead, eyebrow, actions, media, align = "center", level = 1, className }: HeroProps) {
  return (
    <section className={["sf-site-hero", className].filter(Boolean).join(" ")} data-align={align}>
      {eyebrow != null && <p className="sf-site-eyebrow">{eyebrow}</p>}
      {heading(level, { className: "sf-site-hero-title" }, title)}
      {lead != null && <p className="sf-site-lead">{lead}</p>}
      {actions != null && <div className="sf-site-actions">{actions}</div>}
      {media != null && <div className="sf-site-hero-media">{media}</div>}
    </section>
  );
}

export interface SectionProps {
  heading: ReactNode;
  eyebrow?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  /** The heading's level. Defaults to 2. */
  level?: Heading;
  className?: string;
}

/** A part of a page under its own heading, with room around it. Named by its heading for assistive technology. */
export function Section({ heading: title, eyebrow, lead, children, level = 2, className }: SectionProps) {
  const id = useId();
  return (
    <section className={["sf-site-section", className].filter(Boolean).join(" ")} aria-labelledby={id}>
      <div className="sf-site-section-head">
        {eyebrow != null && <p className="sf-site-eyebrow">{eyebrow}</p>}
        {heading(level, { id, className: "sf-site-section-title" }, title)}
        {lead != null && <p className="sf-site-section-lead">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

export interface FeatureItem {
  id: string;
  title: string;
  line?: string;
  /** A link. Without one the item is a button that calls `onSelect`. */
  href?: string;
}

export interface FeatureGridProps {
  items: FeatureItem[];
  /** What the list is, for assistive technology. */
  label?: string;
  onSelect?(id: string): void;
  className?: string;
}

/** Cards of a title and a line each, as many to a row as the container fits. Each is a link or a button. */
export function FeatureGrid({ items, label, onSelect, className }: FeatureGridProps) {
  return (
    <ul className={["sf-site-features", className].filter(Boolean).join(" ")} aria-label={label}>
      {items.map((item) => {
        const body = (
          <>
            <span className="sf-site-feature-title">{item.title}</span>
            {item.line && <span className="sf-site-feature-line">{item.line}</span>}
          </>
        );
        return (
          <li key={item.id}>
            {item.href ? (
              <a className="sf-site-feature" href={item.href}>
                {body}
              </a>
            ) : (
              <button type="button" className="sf-site-feature" onClick={() => onSelect?.(item.id)} disabled={!onSelect}>
                {body}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type Device = "desktop" | "phone";

export interface DeviceFrameProps {
  /** Draws `children` in each, side by side. Defaults to a desktop and a phone. Under 40rem of room only the last stands. */
  devices?: Device[];
  /** The desktop window's title. */
  title?: string;
  /** What the screen shows, for assistive technology; each screen is named after its device and this. */
  label?: string;
  /** Draws the content for one device. Called once per device. */
  children: ReactNode | ((device: Device) => ReactNode);
  className?: string;
}

const DEVICE_NAME: Record<Device, string> = { desktop: "Desktop", phone: "Phone" };

/**
 * A desktop window and a phone around the same content, for showing a product. The screens scroll on their own and
 * can be focused to scroll by keyboard. The frames are drawing only: they are hidden from assistive technology.
 */
export function DeviceFrame({ devices = ["desktop", "phone"], title, label, children, className }: DeviceFrameProps) {
  const shown = devices.length ? [...new Set(devices)] : (["desktop", "phone"] as Device[]);
  const content = (device: Device) => (typeof children === "function" ? children(device) : children);
  const screen = (device: Device) => (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region is focused to scroll it by keyboard
    <section className="sf-site-screen sf-container" aria-label={label ? `${DEVICE_NAME[device]}: ${label}` : DEVICE_NAME[device]} tabIndex={0}>
      {content(device)}
    </section>
  );
  return (
    <div className={["sf-site-devices", className].filter(Boolean).join(" ")}>
      <div className="sf-site-devices-row" data-count={shown.length}>
      {shown.map((device) =>
        device === "desktop" ? (
          <figure key={device} className="sf-site-desktop">
            <div className="sf-site-desktop-bar" aria-hidden="true">
              <span />
              <span />
              <span />
              <p>{title ?? ""}</p>
            </div>
            <div className="sf-site-desktop-body">{screen(device)}</div>
            <figcaption>{DEVICE_NAME.desktop}</figcaption>
          </figure>
        ) : (
          <figure key={device} className="sf-site-phone">
            <div className="sf-site-phone-frame">
              <div className="sf-site-phone-island" aria-hidden="true" />
              <div className="sf-site-phone-body">{screen(device)}</div>
            </div>
            <figcaption>{DEVICE_NAME.phone}</figcaption>
          </figure>
        ),
      )}
      </div>
    </div>
  );
}

function useReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(query);
    const change = () => setReduce(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return reduce;
}

/** How fast the prompt types, how long the answer holds before it starts again, in milliseconds. */
export const PROMPT_REVEAL_TIMING = { type: 28, start: 400, hold: 9000, restart: 600 } as const;

export interface PromptRevealProps {
  /** What a person asks, typed out first. */
  prompt: string;
  /** The answer, shown once the prompt is typed. */
  children: ReactNode;
  /** Starts again after a pause. Defaults to true. */
  loop?: boolean;
  /** What is shown, for the status line. */
  label?: string;
  className?: string;
}

/**
 * A prompt typed out and its answer shown, then again. Under reduced motion, once paused, or once a person reaches
 * into the answer, it shows the finished answer and stands still. It has a Pause button, since it moves for longer
 * than five seconds. Assistive technology reads the whole prompt at once, never letter by letter.
 */
export function PromptReveal({ prompt, children, loop = true, label, className }: PromptRevealProps) {
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const still = reduce || paused;
  const [typed, setTyped] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (still) return;
    let count = 0;
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      if (count < prompt.length) {
        count += 1;
        setTyped(count);
        timer = setTimeout(step, PROMPT_REVEAL_TIMING.type);
      } else if (loop) {
        timer = setTimeout(() => {
          count = 0;
          setTyped(0);
          setRound((r) => r + 1);
          timer = setTimeout(step, PROMPT_REVEAL_TIMING.restart);
        }, PROMPT_REVEAL_TIMING.hold);
      }
    };
    setTyped(0);
    timer = setTimeout(step, PROMPT_REVEAL_TIMING.start);
    return () => clearTimeout(timer);
  }, [still, prompt, loop]);
  const shown = still ? prompt.length : typed;
  const done = shown >= prompt.length;
  const status = reduce ? "Shown finished, since your system asks for less motion." : paused ? "Paused." : done ? "Answered." : "Typing.";
  return (
    <div className={["sf-site-prompt-reveal", className].filter(Boolean).join(" ")}>
      <p className="sf-visually-hidden">{prompt}</p>
      <p className="sf-site-prompt" aria-hidden="true">
        <span>{prompt.slice(0, shown) || " "}</span>
        {!done && <span className="sf-site-caret" />}
      </p>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it only watches for a person reaching into the answer, to stop it moving */}
      {/* The answer keeps its place while the prompt types, hidden and out of reach, so the page does not jump; it is
          drawn afresh each time it is shown, so whatever rises in as it is drawn rises in again. */}
      <div
        key={done ? `shown-${round}` : "waiting"}
        className="sf-site-answer"
        data-shown={done || undefined}
        ref={(element) => {
          // Set here, not as a prop: React 18 does not know `inert`.
          if (element) element.inert = !done;
        }}
        aria-hidden={done ? undefined : true}
        onPointerDown={() => setPaused(true)}
        onFocus={() => setPaused(true)}
      >
        {children}
      </div>
      <div className="sf-site-reveal-foot">
        <p className="sf-site-reveal-status" role="status">
          {label ? `${label}. ` : ""}
          {status}
        </p>
        {!reduce && (
          <button type="button" className="sf-button" aria-pressed={paused} onClick={() => setPaused((p) => !p)}>
            {paused ? "Play" : "Pause"}
          </button>
        )}
      </div>
    </div>
  );
}

export interface ShowcaseItem {
  id: string;
  name: string;
  line?: string;
  content: ReactNode;
}

export interface ShowcaseProps {
  items: ShowcaseItem[];
  /** What the picker chooses between, for assistive technology. */
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?(id: string): void;
  className?: string;
}

/** A picker of named examples above a stage that shows the chosen one. The picker wraps rather than run past the edge. */
export function Showcase({ items, label, value, defaultValue, onChange, className }: ShowcaseProps) {
  const name = useId();
  const [own, setOwn] = useState(defaultValue ?? items[0]?.id);
  const current = items.find((item) => item.id === (value ?? own)) ?? items[0];
  const choose = (id: string) => {
    setOwn(id);
    onChange?.(id);
  };
  return (
    <div className={["sf-site-showcase", className].filter(Boolean).join(" ")}>
      <div className="sf-segmented sf-site-showcase-picker" role="radiogroup" aria-label={label} data-thumb="off">
        {items.map((item) => (
          <label key={item.id} className="sf-segment" data-checked={item.id === current?.id || undefined}>
            <input type="radio" name={name} value={item.id} checked={item.id === current?.id} onChange={() => choose(item.id)} />
            {item.name}
          </label>
        ))}
      </div>
      {current && (
        <div key={current.id} className="sf-site-showcase-stage">
          <p className="sf-site-showcase-name">{current.name}</p>
          {current.line && <p className="sf-site-showcase-line">{current.line}</p>}
          {current.content}
        </div>
      )}
    </div>
  );
}

export interface FooterLink {
  id: string;
  label: string;
  href?: string;
}

export interface FooterProps {
  groups: { label?: string; items: FooterLink[] }[];
  /** A line at the very end: a copyright, a licence. */
  note?: ReactNode;
  onSelect?(id: string): void;
  label?: string;
  className?: string;
}

/** The end of a site's page: columns of links that wrap to the container, and a note. */
export function Footer({ groups, note, onSelect, label = "Site", className }: FooterProps) {
  return (
    <footer className={["sf-site-footer", className].filter(Boolean).join(" ")}>
      <nav className="sf-site-footer-groups" aria-label={label}>
        {groups.map((group, index) => (
          <div key={group.label ?? index} className="sf-site-footer-group">
            {group.label && <p className="sf-site-footer-label">{group.label}</p>}
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <a href={item.href}>{item.label}</a>
                  ) : (
                    <button type="button" className="sf-site-link" onClick={() => onSelect?.(item.id)} disabled={!onSelect}>
                      {item.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {note != null && <p className="sf-site-footer-note">{note}</p>}
    </footer>
  );
}

export type MediaRatio = "16:9" | "4:3" | "3:2" | "1:1" | "21:9";

export interface MediaProps {
  /** The address. Without one, the description stands in its place. */
  src?: string;
  /** What it shows, for anyone who cannot see it. An empty string marks it as decoration. */
  alt: string;
  kind?: "image" | "video";
  ratio?: MediaRatio;
  caption?: ReactNode;
  className?: string;
}

/**
 * An image or a video at a fixed ratio, so nothing moves as it loads, and loaded only near the screen. A video has
 * controls and never plays on its own. With no address, its description is shown in the space it would take.
 */
export function Media({ src, alt, kind = "image", ratio = "16:9", caption, className }: MediaProps) {
  const style = { "--sf-site-ratio": ratio.replace(":", " / ") } as CSSProperties;
  const body = !src ? (
    <div className="sf-site-media-missing" role={alt ? "img" : undefined} aria-label={alt || undefined}>
      <span aria-hidden="true">{alt || "Image"}</span>
    </div>
  ) : kind === "video" ? (
    // biome-ignore lint/a11y/useMediaCaption: captions are the host's to add to the file
    <video className="sf-site-media-body" src={src} controls preload="none" aria-label={alt || undefined} />
  ) : (
    <img className="sf-site-media-body" src={src} alt={alt} loading="lazy" decoding="async" />
  );
  return (
    <figure className={["sf-site-media", className].filter(Boolean).join(" ")} style={style}>
      {body}
      {caption != null && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

export interface QuoteProps {
  children: ReactNode;
  /** Who said it. */
  cite?: ReactNode;
  /** Where it was said. */
  href?: string;
  className?: string;
}

/** A pull quote, with who said it. */
export function Quote({ children, cite, href, className }: QuoteProps) {
  return (
    <figure className={["sf-site-quote", className].filter(Boolean).join(" ")}>
      <blockquote cite={href}>{children}</blockquote>
      {cite != null && <figcaption>{href ? <a href={href}>{cite}</a> : cite}</figcaption>}
    </figure>
  );
}

export type CalloutTone = "note" | "tip" | "warning";
const TONE_NAME: Record<CalloutTone, string> = { note: "Note", tip: "Tip", warning: "Warning" };

export interface CalloutProps {
  tone?: CalloutTone;
  /** Its heading. Without one, the tone's name ("Note") is the heading, so the kind is never told by colour alone. */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** A note set apart from the text around it: a note, a tip or a warning. */
export function Callout({ tone = "note", title, children, className }: CalloutProps) {
  return (
    <aside className={["sf-site-callout", className].filter(Boolean).join(" ")} data-tone={tone} aria-label={typeof title === "string" ? title : TONE_NAME[tone]}>
      <p className="sf-site-callout-title">{title ?? TONE_NAME[tone]}</p>
      <div className="sf-site-callout-body">{children}</div>
    </aside>
  );
}

export interface Post {
  id: string;
  title: string;
  /** An ISO date, shown in the reader's own words for it. */
  date?: string;
  excerpt?: string;
  tags?: string[];
  href?: string;
}

export interface PostCardProps extends Post {
  onOpen?(id: string): void;
  /** The title's heading level. Defaults to 3. */
  level?: Heading;
  className?: string;
}

/** A UTC date read as words, or the text as given when it is not a date. */
export function postDate(date: string, locale?: string): string {
  const time = Date.parse(date);
  return Number.isNaN(time) ? date : new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(time);
}

/** A post in a list: its title as a link or a button, the date, a line of it and its tags. */
export function PostCard({ id, title, date, excerpt, tags, href, onOpen, level = 3, className }: PostCardProps) {
  return (
    <article className={["sf-site-post", className].filter(Boolean).join(" ")}>
      {heading(
        level,
        { className: "sf-site-post-title" },
        href ? (
          <a href={href}>{title}</a>
        ) : onOpen ? (
          <button type="button" className="sf-site-link" onClick={() => onOpen(id)}>
            {title}
          </button>
        ) : (
          title
        ),
      )}
      {date && (
        <p className="sf-site-post-date">
          <time dateTime={date}>{postDate(date)}</time>
        </p>
      )}
      {excerpt && <p className="sf-site-post-excerpt">{excerpt}</p>}
      {tags && tags.length > 0 && (
        <ul className="sf-site-post-tags" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export interface PostListProps {
  posts: Post[];
  label?: string;
  onOpen?(id: string): void;
  className?: string;
}

/** Posts newest first as given, one card each. */
export function PostList({ posts, label, onOpen, className }: PostListProps) {
  if (posts.length === 0) return <p className="sf-site-empty">Nothing here yet.</p>;
  return (
    <ul className={["sf-site-posts", className].filter(Boolean).join(" ")} aria-label={label}>
      {posts.map((post) => (
        <li key={post.id}>
          <PostCard {...post} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
