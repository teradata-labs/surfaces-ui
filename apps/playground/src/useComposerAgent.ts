import { recordMessage, traceAgent, traceDataSource } from "@surfaces-ui/trace";
import { useRecorder } from "@surfaces-ui/trace/react";
import type { DataRef } from "@surfaces-ui/components";
import type { AgentBackend } from "@surfaces-ui/agent";
import { type SurfaceAction, type SurfaceComponent, type SurfaceMessage, analyticsCatalog, upgradeMessage } from "@surfaces-ui/spec";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentChoice } from "./agentChoice.js";
import { agentFor, composerPrompt, datasetOutline, runTurn } from "./composerAgent.js";
import type { DataFocus } from "./focus.js";
import type { ActiveSource } from "./source.js";

/** One line of the agent transcript. */
export interface TranscriptEntry {
  role: "person" | "agent" | "event";
  text: string;
  /** Agent: who answered, always shown. */
  generatedBy?: string;
  /** Agent: how many A2UI messages it added. */
  added?: number;
  notes?: string[];
  error?: string;
  pending?: boolean;
}

/** What the composer holds when a turn starts. */
export interface ComposerState {
  surfaceId: string;
  components: SurfaceComponent[];
  existing: Set<string>;
  dataModel: unknown;
  controls: Record<string, Record<string, unknown>>;
  /** What the person did on the surface since the last turn, oldest first. Handed over once. */
  activity?: { componentId: string; kind: string; summary: string; subject?: Record<string, unknown>; at: string }[];
}

export interface AgentTurnRecord {
  label: string;
  generatedBy: string;
  added: number;
  error?: string;
  /** The messages text before the turn's messages were added, to restore. */
  before?: string;
}

/**
 * The composer's agent: which agents are within reach, the picked one, its
 * conversation, and turns. A turn sends the instruction (or an event from the
 * surface) with the surface as it stands; the A2UI messages that come back
 * are handed to `append`, which adds them to the composer's list.
 */
export function useComposerAgent(options: {
  source: ActiveSource;
  focus: DataFocus;
  state(): ComposerState;
  /** Adds the agent's messages; returns the messages text from before, for the history. */
  append(messages: SurfaceMessage[]): string | undefined;
  onTurn(record: AgentTurnRecord): void;
  /** On a real source: what to tell the agent about the tables in use, read at each turn. Without it the source's first tables are outlined. */
  outline?(): string;
}) {
  const { source, focus } = options;
  const choice = useAgentChoice(source.kind === "server");
  const { picked } = choice;
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [forwardEvents, setForwardEvents] = useState(true);
  const controller = useRef<AbortController | undefined>(undefined);
  const session = useRef("");
  const outline = useRef<{ sourceId: string; text: Promise<string> } | undefined>(undefined);
  const latest = useRef(options);
  latest.current = options;

  // With the dev tools on, the agent and the data source its tools read are traced: this hook calls the agent itself,
  // outside `useChat`, so it uses the explicit wrappers.
  const recorder = useRecorder();
  const agent = useMemo<AgentBackend | undefined>(() => {
    if (!picked) return undefined;
    const built = agentFor(picked, recorder ? traceDataSource(source.dataSource, recorder) : source.dataSource, focus, undefined, source.semantics, choice.model);
    return recorder ? traceAgent(built, recorder) : built;
  }, [picked, source.dataSource, focus, source.semantics, choice.model, recorder]);

  const newConversation = useCallback(() => {
    controller.current?.abort();
    session.current = "";
    setTranscript([]);
    setBusy(false);
  }, []);
  // A different agent or dataset starts a new conversation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on these changes only.
  useEffect(() => {
    newConversation();
  }, [picked.id, focus.sourceId]);

  const turn = useCallback(
    async (input: { case: "text"; value: string } | { case: "action"; value: SurfaceAction }, label: string, references: DataRef[] = []) => {
      if (!agent || !picked) return;
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setBusy(true);
      const state = latest.current.state();
      const surfaceId = state.surfaceId || "main";
      setTranscript((t) => [...t, input.case === "text" ? { role: "person", text: label || input.value } : { role: "event", text: label }, { role: "agent", text: "", pending: true }]);
      const update = (entry: Partial<TranscriptEntry>) =>
        setTranscript((t) => {
          const next = [...t];
          const last = next.length - 1;
          if (last >= 0 && next[last]!.role === "agent") next[last] = { ...next[last]!, ...entry };
          return next;
        });
      try {
        let send = input;
        if (input.case === "text") {
          if (outline.current?.sourceId !== focus.sourceId) outline.current = { sourceId: focus.sourceId, text: datasetOutline(source.dataSource, focus.sourceId).catch(() => "") };
          // A text-only agent learns the catalog on the first turn of its conversation from `agentFor` (`withGuide`); tool-calling agents have it as their system prompt.
          send = { case: "text", value: composerPrompt({ instruction: input.value, surfaceId, components: state.components, outline: latest.current.outline ? latest.current.outline() : await outline.current.text }) };
        }
        const result = await runTurn(
          agent,
          {
            sessionId: session.current,
            agentId: picked.agentId,
            input: send,
            surfaces: state.components.length > 0 ? [{ surfaceId, dataModel: state.dataModel, controls: state.controls, activity: state.activity ?? [] }] : [],
            existing: state.existing,
            references,
          },
          {
            signal: current.signal,
            onText: (text) => update({ text }),
            // The Playground applies messages in its own way (they can be edited and restored), and its surface is
            // recorded whole each time it changes; the agent's messages are recorded as they came, for reading.
            onSurface: recorder ? (raw) => void recordMessage(recorder, { format: "a2ui", key: `agent:${surfaceId}`, raw, message: upgradeMessage(raw), issues: analyticsCatalog.validateMessage(raw), replay: false }) : undefined,
          },
        );
        session.current = result.sessionId;
        const before = result.messages.length > 0 ? latest.current.append(result.messages) : undefined;
        update({ text: result.text, generatedBy: result.generatedBy, added: result.messages.length, notes: result.notes, error: result.error, pending: false });
        latest.current.onTurn({ label, generatedBy: result.generatedBy, added: result.messages.length, error: result.error, before });
      } finally {
        if (controller.current === current) {
          controller.current = undefined;
          setBusy(false);
        }
      }
    },
    [agent, picked, focus.sourceId, source.dataSource, recorder],
  );

  /** Sends an instruction. `shown` is what the conversation shows for it, when the instruction itself is long (a guided start). */
  const instruct = useCallback((text: string, shown?: string, references: DataRef[] = []) => (text.trim() ? turn({ case: "text", value: text.trim() }, shown ?? text.trim(), references) : Promise.resolve()), [turn]);

  /** An event from the surface goes to the agent, as it would in a chat, unless the person turned that off or the agent is the script. */
  const sendEvent = useCallback(
    (action: SurfaceAction): "sent" | "kept" => {
      if (!forwardEvents || !picked || picked.kind === "scripted" || busy) return "kept";
      void turn({ case: "action", value: action }, `Event "${action.name}" from ${action.sourceComponentId}`);
      return "sent";
    },
    [forwardEvents, picked, busy, turn],
  );

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  return { choice, picked, transcript, busy, instruct, sendEvent, stop, newConversation, forwardEvents, setForwardEvents };
}

export type ComposerAgent = ReturnType<typeof useComposerAgent>;
