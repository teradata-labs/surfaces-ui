import { safeUrl } from "@surfaces-ui/spec";
import { type AgentInfo, ConnectorStatus, type ToolConnector } from "@surfaces-ui/proto";
import { type ReactNode, useId, useState } from "react";
import { type ChatProvider, currentAgent, currentProvider, onIds, toggle } from "./selectors.js";
import type { ChatSettings } from "./useChat.js";

interface ListPanelProps {
  agents: AgentInfo[];
  settings: ChatSettings;
  onSettingsChange(settings: ChatSettings): void;
}

function Search({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <input className="sf-input sf-chat-panel-search" type="search" aria-label={label} placeholder={label} value={value} onChange={(e) => onChange(e.target.value)} />;
}
const matches = (words: string, ...texts: (string | undefined)[]) => {
  const all = texts.join(" ").toLowerCase();
  return words
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => all.includes(w));
};

function Check({ checked, onChange, disabled, name, detail, extra }: { checked: boolean; onChange(): void; disabled?: boolean; name: string; detail?: string; extra?: ReactNode }) {
  const id = useId();
  return (
    <li className="sf-chat-check">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={onChange} aria-describedby={detail ? `${id}-d` : undefined} />
      <label htmlFor={id}>{name}</label>
      {detail && (
        <span id={`${id}-d`} className="sf-chat-check-detail">
          {detail}
        </span>
      )}
      {extra}
    </li>
  );
}

/** Every skill the agent offers, to turn on or off for the next turns. */
export function SkillsPanel({ agents, settings, onSettingsChange }: ListPanelProps) {
  const agent = currentAgent(agents, settings);
  const skills = agent?.skills ?? [];
  const on = onIds(agent, settings).skills;
  const [search, setSearch] = useState("");
  if (skills.length === 0) return <p className="sf-chat-panel-note">{agent ? `${agent.name} offers no skills.` : "No agent offers skills."}</p>;
  const shown = skills.filter((s) => matches(search, s.name, s.description));
  return (
    <div className="sf-chat-panel">
      <p className="sf-chat-panel-note">
        A skill is guidance the agent follows while it is on. {on.length} of {skills.length} on.
      </p>
      {skills.length > 6 && <Search label="Search skills" value={search} onChange={setSearch} />}
      <ul className="sf-chat-checks" aria-label="Skills">
        {shown.map((s) => (
          <Check key={s.id} name={s.name} detail={s.description} checked={on.includes(s.id)} onChange={() => onSettingsChange(toggle(agent, settings, "skills", s.id))} />
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<ConnectorStatus, string> = { [ConnectorStatus.UNSPECIFIED]: "", [ConnectorStatus.CONNECTED]: "Connected", [ConnectorStatus.NEEDS_SIGN_IN]: "Needs sign-in", [ConnectorStatus.UNAVAILABLE]: "Unavailable" };

export interface ConnectorsPanelProps extends ListPanelProps {
  sources?: { id: string; label: string; detail?: string }[];
  onAddConnection?(): void;
  onConnect?(connector: ToolConnector): void;
}

/** Tool connectors the agent may use, and the data connection to browse, in full. */
export function ConnectorsPanel({ agents, settings, onSettingsChange, sources = [], onAddConnection, onConnect }: ConnectorsPanelProps) {
  const agent = currentAgent(agents, settings);
  const tools = agent?.connectors ?? [];
  const on = onIds(agent, settings).connectors;
  const [search, setSearch] = useState("");
  const name = useId();
  const shownTools = tools.filter((c) => matches(search, c.name, c.description));
  const shownSources = sources.filter((s) => matches(search, s.label, s.id));
  return (
    <div className="sf-chat-panel">
      {tools.length + sources.length > 6 && <Search label="Search connectors" value={search} onChange={setSearch} />}
      {tools.length > 0 && (
        <section aria-labelledby={`${name}-tools`}>
          <h3 id={`${name}-tools`} className="sf-chat-panel-heading">
            Tools
          </h3>
          <p className="sf-chat-panel-note">What the agent may use. A tool that changes something still asks you first.</p>
          <ul className="sf-chat-checks">
            {shownTools.map((c) => {
              const connected = c.status === ConnectorStatus.CONNECTED;
              const url = safeUrl(c.signInUrl);
              return (
                <Check
                  key={c.id}
                  name={c.name}
                  detail={[connected ? "" : STATUS[c.status], c.reason, c.description, c.requiresApproval ? "Asks before it acts" : ""].filter(Boolean).join(" · ")}
                  checked={connected && on.includes(c.id)}
                  disabled={!connected}
                  onChange={() => onSettingsChange(toggle(agent, settings, "connectors", c.id))}
                  extra={
                    c.status === ConnectorStatus.NEEDS_SIGN_IN && onConnect && url ? (
                      <button type="button" className="sf-button" onClick={() => onConnect(c)}>
                        Sign in
                      </button>
                    ) : undefined
                  }
                />
              );
            })}
          </ul>
        </section>
      )}
      {(sources.length > 0 || onAddConnection) && (
        <section aria-labelledby={`${name}-data`}>
          <h3 id={`${name}-data`} className="sf-chat-panel-heading">
            Data
          </h3>
          <p className="sf-chat-panel-note">The connection you browse and attach from.</p>
          <ul className="sf-chat-checks" role="radiogroup" aria-labelledby={`${name}-data`}>
            {shownSources.map((s) => (
              <li key={s.id} className="sf-chat-check">
                <input id={`${name}-${s.id}`} type="radio" name={`${name}-source`} checked={settings.sourceId === s.id} onChange={() => onSettingsChange({ ...settings, sourceId: s.id })} />
                <label htmlFor={`${name}-${s.id}`}>{s.label}</label>
                {s.detail && <span className="sf-chat-check-detail">{s.detail}</span>}
              </li>
            ))}
          </ul>
          {onAddConnection && (
            <button type="button" className="sf-button" onClick={onAddConnection}>
              Add a connection…
            </button>
          )}
        </section>
      )}
      {tools.length === 0 && sources.length === 0 && !onAddConnection && <p className="sf-chat-panel-note">Nothing to connect.</p>}
    </div>
  );
}

/** The agent, its skills and its connectors in full: what the composer's setup menu opens. */
export interface AgentSetupPanelProps extends ConnectorsPanelProps {
  /** Where models run, each with its models: listed in full, with where each runs. */
  providers?: ChatProvider[];
  /** "Manage providers": the host's own page for them. */
  onManageProviders?(): void;
}

/** Whether the setup panel has a Model section: several providers, or an agent with more than one model. */
export const choosesModel = (agents: AgentInfo[], providers?: ChatProvider[]) => (providers?.length ?? 0) > 0 || agents.some((a) => a.models.length > 1);

/** Every model a person can pick, under where it runs: the full form of the Model menu. */
export function ModelsPanel({ agents, settings, onSettingsChange, providers, onManageProviders }: AgentSetupPanelProps) {
  const id = useId();
  const [search, setSearch] = useState("");
  const agent = currentAgent(agents, settings);
  const groups: ChatProvider[] =
    providers && providers.length > 0 ? providers : agent && agent.models.length > 1 ? [{ id: "", label: agent.name, models: agent.models.map((m) => ({ id: m.id, label: m.label, detail: [m.id === agent.defaultModel ? "Default" : "", m.description].filter(Boolean).join(" · ") })) }] : [];
  const chosen = providers && providers.length > 0 ? currentProvider(providers, settings) : { provider: groups[0], model: groups[0]?.models.find((m) => m.id === (settings.model || agent?.defaultModel)) };
  const count = groups.reduce((n, g) => n + g.models.length, 0);
  const pick = (provider: string, model: string) =>
    onSettingsChange(providers && providers.length > 0 ? { ...settings, provider, model } : { ...settings, model: model === agent?.defaultModel ? "" : model });
  return (
    <section aria-labelledby={`${id}-models`} className="sf-chat-models">
      <h3 id={`${id}-models`} className="sf-chat-panel-heading">
        Model
      </h3>
      {count > 8 && <Search label="Search models" value={search} onChange={setSearch} />}
      {groups.map((group) => {
        const shown = group.models.filter((m) => matches(search, m.id, m.label, m.detail, group.label));
        if (shown.length === 0) return null;
        return (
          <div key={group.id} className="sf-chat-model-group">
            {providers && providers.length > 0 && (
              <p className="sf-chat-model-provider">
                <span id={`${id}-p-${group.id}`}>{group.label}</span>
                {group.detail && <span className="sf-chat-check-detail">{group.detail}</span>}
              </p>
            )}
            <ul className="sf-chat-checks" role="radiogroup" aria-labelledby={providers && providers.length > 0 ? `${id}-p-${group.id}` : `${id}-models`}>
              {shown.map((m) => {
                const input = `${id}-${group.id}-${m.id}`;
                return (
                  <li key={m.id} className="sf-chat-check">
                    <input id={input} type="radio" name={`${id}-model`} checked={group.id === chosen.provider?.id && m.id === chosen.model?.id} onChange={() => pick(group.id, m.id)} />
                    <label htmlFor={input}>{m.label || m.id}</label>
                    {m.detail && <span className="sf-chat-check-detail">{m.detail}</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {onManageProviders && (
        <button type="button" className="sf-button" onClick={onManageProviders}>
          Manage providers
        </button>
      )}
    </section>
  );
}

export function AgentSetupPanel(props: AgentSetupPanelProps) {
  const { agents, settings, onSettingsChange } = props;
  const agent = currentAgent(agents, settings);
  const id = useId();
  return (
    <div className="sf-chat-panel sf-chat-setup-panel">
      {choosesModel(agents, props.providers) && <ModelsPanel {...props} />}
      {agents.length > 1 && (
        <section aria-labelledby={`${id}-agent`}>
          <h3 id={`${id}-agent`} className="sf-chat-panel-heading">
            Agent
          </h3>
          <ul className="sf-chat-checks" role="radiogroup" aria-labelledby={`${id}-agent`}>
            {agents.map((a) => (
              <li key={a.id} className="sf-chat-check">
                <input id={`${id}-${a.id}`} type="radio" name={`${id}-agents`} checked={a.id === agent?.id} onChange={() => onSettingsChange({ agentId: a.id, ...(settings.sourceId ? { sourceId: settings.sourceId } : {}), ...(settings.provider ? { provider: settings.provider, model: settings.model } : {}) })} />
                <label htmlFor={`${id}-${a.id}`}>{a.name}</label>
                {a.description && <span className="sf-chat-check-detail">{a.description}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(agent?.skills.length ?? 0) > 0 && (
        <section aria-labelledby={`${id}-skills`}>
          <h3 id={`${id}-skills`} className="sf-chat-panel-heading">
            Skills
          </h3>
          <SkillsPanel {...props} />
        </section>
      )}
      {((agent?.connectors.length ?? 0) > 0 || (props.sources?.length ?? 0) > 0 || props.onAddConnection) && <ConnectorsPanel {...props} />}
    </div>
  );
}
