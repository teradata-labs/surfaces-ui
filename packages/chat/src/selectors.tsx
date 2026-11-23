import { safeUrl } from "@surfaces-ui/spec";
import { type AgentInfo, ConnectorStatus, type ToolConnector } from "@surfaces-ui/proto";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { MenuButton, MenuGroup, MenuItem } from "./Menu.js";
import { ChatIcon } from "./icons.js";
import type { ChatSettings } from "./useChat.js";

/** A panel a menu's "View all…" or "Manage…" opens. */
export type ChatPanel = "sessions" | "data" | "setup";

/**
 * Where models run (a provider: a hosted API, a server, a model on this
 * machine), with the models each offers. A host that can reach several gives
 * them to the Model menu; picking a model there sets `provider` and `model`,
 * and the host answers with its own backend. A provider never carries a key.
 */
export interface ChatProvider {
  id: string;
  label: string;
  /** One line on where it runs. */
  detail?: string;
  models: { id: string; label?: string; detail?: string; level?: ModelLevel }[];
}

/**
 * How capable a model is, on the host's own scale: drawn in the Model menu as
 * `of` bars rising left to right, `value` of them filled, beside `label`
 * ("Everyday"). The word is what is read; the bars are only drawn.
 */
export interface ModelLevel {
  value: number;
  of: number;
  label: string;
}

/** A model's level as rising bars and its word, on the line with its name. */
export function ModelLevelBars({ level }: { level: ModelLevel }) {
  const of = Math.max(1, Math.min(5, Math.round(level.of)));
  const value = Math.max(0, Math.min(of, Math.round(level.value)));
  return (
    <span className="sf-chat-model-level">
      <span className="sf-chat-model-bars" aria-hidden="true">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} data-on={i < value || undefined} style={{ blockSize: `${Math.round(((i + 1) / of) * 100)}%` }} />
        ))}
      </span>
      {level.label}
    </span>
  );
}

export interface SelectorProps {
  agents: AgentInfo[];
  settings: ChatSettings;
  onSettingsChange(settings: ChatSettings): void;
  /** Opens the panel with the whole list. Without it, a menu lists everything. */
  onManage?(panel: ChatPanel): void;
  /** Items a menu shows before "View all…". Default 5. */
  limit?: number;
  /** Icons only, for a narrow composer; each keeps its full name as its label and tooltip. */
  compact?: boolean;
}

/** The agent the settings name, or the default one. */
export const currentAgent = (agents: AgentInfo[], settings: ChatSettings) => agents.find((a) => a.id === settings.agentId) ?? agents.find((a) => a.isDefault) ?? agents[0];

/** The skill and connector ids on now: what the settings say, or each one's default. */
export function onIds(agent: AgentInfo | undefined, settings: ChatSettings) {
  return {
    skills: settings.skillIds ?? (agent?.skills ?? []).filter((s) => s.defaultOn).map((s) => s.id),
    connectors: settings.connectorIds ?? (agent?.connectors ?? []).filter((c) => c.defaultOn && c.status === ConnectorStatus.CONNECTED).map((c) => c.id),
  };
}

/** Turns one skill or connector on or off, writing both lists so the choice is explicit from then on. */
export function toggle(agent: AgentInfo | undefined, settings: ChatSettings, kind: "skills" | "connectors", id: string): ChatSettings {
  const now = onIds(agent, settings);
  const list = now[kind].includes(id) ? now[kind].filter((x) => x !== id) : [...now[kind], id];
  return { ...settings, skillIds: kind === "skills" ? list : now.skills, connectorIds: kind === "connectors" ? list : now.connectors };
}

const STATUS_WORD: Partial<Record<ConnectorStatus, string>> = { [ConnectorStatus.NEEDS_SIGN_IN]: "Needs sign-in", [ConnectorStatus.UNAVAILABLE]: "Unavailable" };

export interface ModelMenuProps extends SelectorProps {
  /** Several providers: the menu groups their models under each one's name. */
  providers?: ChatProvider[];
  /** "Manage providers…": the host's own page for them. */
  onManageProviders?(): void;
}

/** The provider and model the settings name, or the first offered. */
export function currentProvider(providers: ChatProvider[], settings: ChatSettings) {
  const provider = providers.find((p) => p.id === settings.provider) ?? providers[0];
  const model = provider?.models.find((m) => m.id === settings.model) ?? provider?.models[0];
  return { provider, model };
}

/**
 * Which model answers. With `providers`, every model of every provider in
 * groups, so the person sees where it runs; otherwise the agent's models.
 */
export function ModelMenu(props: ModelMenuProps) {
  const { agents, settings, onSettingsChange, compact, providers, onManage, limit = 5 } = props;
  if (providers && providers.length > 0) {
    const { provider, model } = currentProvider(providers, settings);
    // A few models from each provider, the chosen one always among them; the rest are in the setup panel.
    const few = (p: ChatProvider) => (onManage ? p.models.filter((m, i) => i < limit || (p.id === provider?.id && m.id === model?.id)) : p.models);
    const total = providers.reduce((n, p) => n + p.models.length, 0);
    const hidden = providers.some((p) => few(p).length < p.models.length);
    const text = model?.label || model?.id || provider?.label || "Model";
    return (
      <MenuButton label={`Model: ${text}${provider && provider.label !== text ? `, ${provider.label}` : ""}`} text={text} icon="model" iconOnly={compact}>
        {(close) => (
          <>
            {providers.map((p) => (
              <MenuGroup key={p.id} label={p.label}>
                {few(p).map((m) => (
                  <MenuItem
                    key={m.id}
                    role="radio"
                    checked={p.id === provider?.id && m.id === model?.id}
                    detail={m.detail}
                    onSelect={() => {
                      onSettingsChange({ ...settings, provider: p.id, model: m.id });
                      close();
                    }}
                  >
                    {m.level ? (
                      <span className="sf-chat-model-name">
                        <span>{m.label || m.id}</span>
                        <ModelLevelBars level={m.level} />
                      </span>
                    ) : (
                      m.label || m.id
                    )}
                  </MenuItem>
                ))}
              </MenuGroup>
            ))}
            {onManage && hidden && (
              <button
                type="button"
                className="sf-chat-menu-more"
                onClick={() => {
                  close();
                  onManage("setup");
                }}
              >
                View all {total} models…
              </button>
            )}
            {props.onManageProviders && (
              <button
                type="button"
                className="sf-chat-menu-more"
                onClick={() => {
                  close();
                  props.onManageProviders?.();
                }}
              >
                Manage providers…
              </button>
            )}
          </>
        )}
      </MenuButton>
    );
  }
  const agent = currentAgent(agents, settings);
  const models = agent?.models ?? [];
  if (models.length === 0) return null;
  const chosen = settings.model || agent?.defaultModel || "";
  const name = (id: string) => models.find((m) => m.id === id)?.label || id || "Default";
  return (
    <MenuButton label={`Model: ${name(chosen)}`} text={name(chosen)} icon="model" iconOnly={compact}>
      {(close) => (
        <MenuGroup label="Model">
          {models.map((m) => (
            <MenuItem
              key={m.id}
              role="radio"
              checked={m.id === chosen}
              detail={[m.id === agent?.defaultModel ? "Default" : "", m.description].filter(Boolean).join(" · ")}
              onSelect={() => {
                onSettingsChange({ ...settings, model: m.id === agent?.defaultModel ? "" : m.id });
                close();
              }}
            >
              {m.label || m.id}
            </MenuItem>
          ))}
        </MenuGroup>
      )}
    </MenuButton>
  );
}

function more(count: number, hidden: boolean, label: string, onManage: SelectorProps["onManage"], close: () => void) {
  if (!onManage) return null;
  return (
    <button
      type="button"
      className="sf-chat-menu-more"
      onClick={() => {
        close();
        onManage("setup");
      }}
    >
      {hidden ? `View all ${count} ${label}…` : `Manage ${label}…`}
    </button>
  );
}

export interface SetupMenuProps extends SelectorProps {
  /** Data connections a person may browse and attach from. */
  sources?: { id: string; label: string }[];
  /** "Add a connection…": the host opens its own form (`ConnectionBuilder`). */
  onAddConnection?(): void;
  /** A tool connector that needs a person to sign in. The host opens `signInUrl` its own way. */
  onConnect?(connector: ToolConnector): void;
}

type Section = "agent" | "skills" | "connectors";

/** Which sections the setup menu has, and what each says it stands at. */
export function setupSummary(props: Pick<SetupMenuProps, "agents" | "settings" | "sources" | "onAddConnection">) {
  const { agents, settings, sources = [] } = props;
  const agent = currentAgent(agents, settings);
  const on = onIds(agent, settings);
  const skills = agent?.skills ?? [];
  const tools = agent?.connectors ?? [];
  const source = sources.find((s) => s.id === settings.sourceId);
  const sections: { id: Section; title: string; detail: string }[] = [];
  if (agents.length > 1) sections.push({ id: "agent", title: "Agent", detail: agent?.name ?? "" });
  if (skills.length > 0) sections.push({ id: "skills", title: "Skills", detail: `${on.skills.length} of ${skills.length} on` });
  if (tools.length > 0 || sources.length > 0 || props.onAddConnection)
    sections.push({ id: "connectors", title: "Connectors", detail: [tools.length > 0 ? `${on.connectors.length} of ${tools.length} tools on` : "", source ? `data: ${source.label}` : ""].filter(Boolean).join(" · ") });
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const text = [agents.length > 1 ? (agent?.name ?? "") : "", skills.length > 0 ? plural(on.skills.length, "skill") : "", tools.length > 0 ? plural(on.connectors.length, "tool") : ""].filter(Boolean).join(" · ") || "Connectors";
  return { sections, text };
}

/**
 * The agent, its skills and its connectors in one menu. Each section opens
 * in place, with a way back, so it works the same in a narrow frame and by
 * touch: Enter or → goes in, ← or Escape comes back. Each ends in "View
 * all…" or "Manage…", which opens the setup panel.
 */
export function SetupMenu(props: SetupMenuProps) {
  const { sections, text } = setupSummary(props);
  if (sections.length === 0) return null;
  return (
    <MenuButton label={`Agent setup: ${text}`} text={text} icon="agent" iconOnly={props.compact} className="sf-chat-setup-menu">
      {(close) => <SetupContent {...props} sections={sections} close={close} />}
    </MenuButton>
  );
}

function SetupContent(props: SetupMenuProps & { sections: { id: Section; title: string; detail: string }[]; close(): void }) {
  const { agents, settings, onSettingsChange, onManage, limit = 5, sources = [], onAddConnection, onConnect, sections, close } = props;
  // With one section there is nothing to choose between: open on it.
  const only = sections.length === 1 ? sections[0]!.id : undefined;
  const [view, setView] = useState<Section | "root">(only ?? "root");
  const box = useRef<HTMLDivElement>(null);
  const from = useRef<Section | undefined>(undefined);
  useEffect(() => {
    // Focus the first choice in a section, or the row just left when coming back.
    const target = view === "root" && from.current ? box.current?.querySelector<HTMLElement>(`[data-section="${from.current}"]`) : box.current?.querySelector<HTMLElement>("button");
    target?.focus();
  }, [view]);
  const go = (next: Section | "root") => {
    if (next === "root" && view !== "root") from.current = view;
    setView(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (view === "root" || only) return;
    if (event.key === "Escape" || event.key === "ArrowLeft") {
      event.stopPropagation();
      event.preventDefault();
      go("root");
    }
  };

  const agent = currentAgent(agents, settings);
  const on = onIds(agent, settings);
  const title = sections.find((s) => s.id === view)?.title ?? "";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the keys move between the menu's own buttons
    <div ref={box} className="sf-chat-setup" onKeyDown={onKeyDown}>
      {/* Keyed by the view, so each opens with a short slide: a section from the side it is reached by, the list back. */}
      <div key={view} className="sf-chat-setup-view" data-to={view === "root" ? "back" : "in"}>
      {view === "root" ? (
        <MenuGroup label="Agent setup">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className="sf-chat-menu-item sf-chat-menu-section"
              data-section={s.id}
              aria-label={`${s.title}: ${s.detail}`}
              onClick={() => go(s.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  go(s.id);
                }
              }}
            >
              <span className="sf-chat-menu-mark" />
              <span className="sf-chat-menu-text">
                {s.title}
                <span className="sf-chat-menu-detail">{s.detail}</span>
              </span>
              <ChatIcon name="next" />
            </button>
          ))}
        </MenuGroup>
      ) : (
        <>
          {!only && (
            <button type="button" className="sf-chat-menu-back" onClick={() => go("root")}>
              <ChatIcon name="back" />
              <span>Agent setup</span>
            </button>
          )}
          {view === "agent" && (
            <MenuGroup label={title}>
              {agents.map((a) => (
                <MenuItem
                  key={a.id}
                  role="radio"
                  checked={a.id === agent?.id}
                  detail={a.description}
                  onSelect={() => {
                    // Another agent offers other models, skills and connectors: start from its defaults.
                    onSettingsChange({ agentId: a.id, ...(settings.sourceId ? { sourceId: settings.sourceId } : {}) });
                    go("root");
                  }}
                >
                  {a.name}
                </MenuItem>
              ))}
            </MenuGroup>
          )}
          {view === "skills" && (
            <>
              <MenuGroup label={title}>
                {(onManage ? (agent?.skills ?? []).slice(0, limit) : (agent?.skills ?? [])).map((s) => (
                  <MenuItem key={s.id} role="checkbox" checked={on.skills.includes(s.id)} detail={s.description} onSelect={() => onSettingsChange(toggle(agent, settings, "skills", s.id))}>
                    {s.name}
                  </MenuItem>
                ))}
              </MenuGroup>
              {more(agent?.skills.length ?? 0, (agent?.skills.length ?? 0) > limit, "skills", onManage, close)}
            </>
          )}
          {view === "connectors" && (
            <ConnectorChoices agent={agent} settings={settings} onSettingsChange={onSettingsChange} sources={sources} onAddConnection={onAddConnection} onConnect={onConnect} limit={onManage ? limit : Number.POSITIVE_INFINITY} close={close} />
          )}
          {view === "connectors" && more((agent?.connectors.length ?? 0) + sources.length, (agent?.connectors.length ?? 0) > limit || sources.length > limit, "connectors", onManage, close)}
        </>
      )}
      </div>
    </div>
  );
}

function ConnectorChoices({ agent, settings, onSettingsChange, sources, onAddConnection, onConnect, limit, close }: { agent: AgentInfo | undefined; settings: ChatSettings; onSettingsChange(settings: ChatSettings): void; sources: { id: string; label: string }[]; onAddConnection?(): void; onConnect?(connector: ToolConnector): void; limit: number; close(): void }) {
  const tools = agent?.connectors ?? [];
  const on = onIds(agent, settings).connectors;
  return (
    <>
      {tools.length > 0 && (
        <MenuGroup label="Tools">
          {tools.slice(0, limit).map((c) =>
            c.status === ConnectorStatus.CONNECTED ? (
              <MenuItem key={c.id} role="checkbox" checked={on.includes(c.id)} detail={[c.description, c.requiresApproval ? "Asks before it acts" : ""].filter(Boolean).join(" · ")} onSelect={() => onSettingsChange(toggle(agent, settings, "connectors", c.id))}>
                {c.name}
              </MenuItem>
            ) : (
              <MenuItem
                key={c.id}
                detail={[STATUS_WORD[c.status], c.reason].filter(Boolean).join(": ")}
                disabled={c.status !== ConnectorStatus.NEEDS_SIGN_IN || !onConnect || !safeUrl(c.signInUrl)}
                onSelect={() => {
                  close();
                  onConnect?.(c);
                }}
              >
                {c.status === ConnectorStatus.NEEDS_SIGN_IN ? `Sign in to ${c.name}` : c.name}
              </MenuItem>
            ),
          )}
        </MenuGroup>
      )}
      {(sources.length > 0 || onAddConnection) && (
        <MenuGroup label="Data">
          {sources.slice(0, limit).map((s) => (
            <MenuItem key={s.id} role="radio" checked={s.id === settings.sourceId} onSelect={() => onSettingsChange({ ...settings, sourceId: s.id })}>
              {s.label}
            </MenuItem>
          ))}
          {onAddConnection && (
            <MenuItem
              onSelect={() => {
                close();
                onAddConnection();
              }}
            >
              Add a connection…
            </MenuItem>
          )}
        </MenuGroup>
      )}
    </>
  );
}
