import { useId } from "react";
import type { AgentChoice } from "./agentChoice.js";
import type { AgentKind } from "./composerAgent.js";

export const KIND_LABEL: Record<AgentKind, string> = {
  scripted: "Scripted, not a model",
  server: "Dev server",
  local: "Local model",
  loom: "Loom",
};

/**
 * The Models page's own picker: which provider and model the Playground,
 * Chat, Pages and Semantic pages use. Those pages change it from their
 * composer's Model menu; the choice is the same everywhere.
 */
export function AgentPicker({ choice, compact }: { choice: AgentChoice; compact?: boolean }) {
  const id = useId();
  const { picked } = choice;
  return (
    <div className="agent-picker">
      <div className="agent-picker-row">
        <label htmlFor={id}>Model the pages use</label>
        <select id={id} value={picked.id} onChange={(e) => choice.pick(e.target.value)}>
          {choice.agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <span className={`badge${picked.kind === "scripted" ? " warn" : ""}`}>{KIND_LABEL[picked.kind]}</span>
        <a href="#models">Models</a>
      </div>
      {!compact && <p className="hint">{picked.detail}</p>}
      {choice.missing && (
        <p className="hint" role="status">
          The model picked before ({choice.missing}) is not within reach now, so the scripted demo answers.
        </p>
      )}
    </div>
  );
}
