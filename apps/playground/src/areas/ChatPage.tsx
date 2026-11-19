import { describesAgents } from "@surfaces-ui/agent";
import { AnalyticsChat, type AttachResult, type ChatSettings, browserSpeech, librarySessions } from "@surfaces-ui/chat";
import type { WorkspaceLayout } from "@surfaces-ui/components";
import { type AgentInfo, AgentInfoSchema } from "@surfaces-ui/proto";
import { safeUrl } from "@surfaces-ui/spec";
import { create } from "@bufbuild/protobuf";
import { useEffect, useMemo, useState } from "react";
import { useAgentChoice } from "../agentChoice.js";
import { agentFor } from "../composerAgent.js";
import { ARCHIVE_STARTER, demoAgent } from "../demoAgent.js";
import { focusFor } from "../focus.js";
import { pickProvider, providerSettings, providersOf } from "../providers.js";
import { type ActiveSource, firstTable, isRealSource, sampleSource } from "../source.js";

const LAYOUT_KEY = "surfaces-playground:chat-layout";
const VOICE_KEY = "surfaces-playground:chat-voice";
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
};

/** A chat for people who work with data: saved conversations, files and tables to attach, the agent's model, skills and connectors, and voice. */
export function ChatPage({ source: pickedSource }: { source: ActiveSource }) {
  const choice = useAgentChoice(pickedSource.kind === "server");
  const { picked } = choice;
  // A real source (a warehouse) has no script written for it: the scripted demo stays on sample data, and a model works on the source itself.
  const real = isRealSource(pickedSource);
  const scriptedOnSample = real && picked.kind === "scripted";
  const source = scriptedOnSample ? sampleSource(pickedSource) : pickedSource;
  const label = (id: string) => pickedSource.sources.find((s) => s.id === id)?.label ?? id;

  // App hands each area a fresh source object; key the agent on what it reads so a thread is not reset on every render.
  const table = firstTable(source);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the focus depends only on the source id and table.
  const focus = useMemo(() => focusFor(source.sourceId, table), [source.sourceId, table]);
  const agent = useMemo(() => agentFor(picked, source.dataSource, focus, () => demoAgent(source.dataSource, focus), source.semantics, choice.model), [picked, source.dataSource, focus, source.semantics, choice.model]);
  // Where the model runs is picked in the composer's Model menu, grouped by provider.
  const providers = useMemo(() => providersOf(choice.agents), [choice.agents]);
  const scripted = picked.kind === "scripted";

  // What the agent offers: models, skills and connectors, from DescribeAgents where the backend answers it.
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  useEffect(() => {
    let live = true;
    const named = [create(AgentInfoSchema, { id: picked.agentId || picked.id, name: picked.label, isDefault: true })];
    if (!describesAgents(agent)) setAgents(named);
    else
      agent.describeAgents().then(
        (r) => live && setAgents(r.agents.length > 0 ? r.agents : named),
        () => live && setAgents(named),
      );
    return () => {
      live = false;
    };
  }, [agent, picked]);
  const [settings, setSettings] = useState<ChatSettings>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new backend or source starts from its own defaults.
  useEffect(() => setSettings({ sourceId: source.sourceId }), [picked.id, source.sourceId]);

  const sessions = useMemo(() => librarySessions(source.library), [source.library]);
  // The microphone shows wherever the browser can listen; its first press says where audio goes and asks.
  const speech = useMemo(() => browserSpeech(), []);
  const [voice, setVoice] = useState(() => read(VOICE_KEY) === "on");
  const [layout, setLayout] = useState<WorkspaceLayout | undefined>(() => {
    try {
      return JSON.parse(read(LAYOUT_KEY) ?? "null") ?? undefined;
    } catch {
      return undefined;
    }
  });

  // A file becomes a table only where DuckDB runs in this page; the dev server never receives a person's file.
  const copy = source.seedCopy;
  const attachFiles = async (files: File[]): Promise<AttachResult[]> => {
    const target = settings.sourceId ?? source.sourceId;
    return Promise.all(
      files.map(async (file): Promise<AttachResult> => {
        if (source.kind !== "browser" || !copy) return { file, error: "Stays on this computer: the dev server cannot read it. Stop the server to load files into DuckDB in this page." };
        try {
          const [name] = await copy.addFiles(target, [file]);
          return { file, ref: { sourceId: target, kind: "table", table: name! } };
        } catch (error) {
          return { file, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
  };

  return (
    <section className="card chat-page analytics-chat-page">
      <AnalyticsChat
        key={source.sourceId}
        agent={agent}
        agents={agents}
        settings={{ ...settings, ...providerSettings(choice) }}
        onSettingsChange={(next) => {
          pickProvider(choice, next);
          setSettings({ ...next, provider: undefined, model: undefined });
        }}
        providers={providers}
        onManageProviders={() => {
          location.hash = "#models";
        }}
        sessions={sessions}
        attachFiles={attachFiles}
        browse={{ sourceId: source.sourceId, sourceLabel: label(source.sourceId) }}
        sources={pickedSource.sources.map((s) => ({ id: s.id, label: s.label }))}
        onAddConnection={() => {
          location.hash = "#sources";
        }}
        onConnect={(connector) => {
          const url = safeUrl(connector.signInUrl);
          if (url) window.open(url, "_blank", "noopener");
        }}
        speech={speech}
        speechConsent={{
          given: voice,
          onGive: () => {
            setVoice(true);
            write(VOICE_KEY, "on");
          },
        }}
        layout={layout}
        onLayoutChange={(next) => {
          setLayout(next);
          write(LAYOUT_KEY, JSON.stringify(next));
        }}
        height="max(30rem, calc(100dvh - 13rem - var(--shell-bar, 0px)))"
        starters={
          scripted
            ? ["Show the data model", `Chart ${focus.trend.label.toLowerCase()}`, `Pivot ${(focus.breakdown.y[0]?.label ?? focus.measure.label).toLowerCase()}`, "Browse the data", "Propose some SQL", "Help me decide", ARCHIVE_STARTER]
            : real
              ? [`Show me what is in the "${source.sourceId}" source and suggest where to start`, `Build a starter dashboard from the best table in the "${source.sourceId}" source`, `How do the main tables in the "${source.sourceId}" source join?`]
              : [`Chart ${focus.trend.label.toLowerCase()}`, `Show ${focus.measure.label.toLowerCase()} as a headline number with its trend`, "What tables are there, and how do they join?"]
        }
        empty={real && !scripted ? `Ask about ${label(source.sourceId)}. The agent can look at its tables (names and types, never values) and draw from them; the suggestions below are ways to start.` : scripted ? "Ask for a chart, a pivot, a table or the data model. Replies are drawn with the same components as the rest of the library." : "Replies come from a model and can take a while, more so from a model on this machine."}
      />
      {choice.missing && (
        <p className="hint" role="status">
          The model picked before ({choice.missing}) is not within reach now, so the scripted demo answers.
        </p>
      )}
      {scriptedOnSample && (
        <p className="shell-sample-note" role="note">
          The scripted demo is shown on sample data ({label(source.sourceId)}). Pick a model above to chat about {label(pickedSource.sourceId)}.
        </p>
      )}
      <p className="hint">
        {scripted
          ? "No model is picked, so replies come from a fixed script. The components in them are real and query this page's data source. Pick a model above, or on the Models page."
          : `${choice.model ? `${picked.provider ?? "The dev server"} on the dev server, model ${choice.model}, picked in the Model menu.` : picked.detail} What it draws is checked against the catalog before it appears.`}{" "}
        Conversations are saved to the Library as you go; the rail on the right opens them, the data browser, skills and connectors.
      </p>
    </section>
  );
}
