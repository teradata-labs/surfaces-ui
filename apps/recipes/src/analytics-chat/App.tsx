import { AnalyticsChat, type AttachResult, browserSpeech, librarySessions } from "@surfaces-ui/chat";
import type { AgentBackend, DescribesAgents } from "@surfaces-ui/agent";
import { DataSourceProvider } from "@surfaces-ui/components";
import { type DataSource, type SurfaceLibrary } from "@surfaces-ui/data";
import type { AgentInfo } from "@surfaces-ui/proto";
import { useEffect, useMemo, useState } from "react";

export interface AnalyticsChatPageProps {
  /** `connectAgent({ baseUrl })` in a real app; anything with `send` and `describeAgents`. */
  agent: AgentBackend & DescribesAgents;
  dataSource: DataSource;
  /** Where conversations are kept: `memorySurfaceLibrary({ storage: browserStorage() })`, or your server's library. */
  library: SurfaceLibrary;
  sourceId: string;
  /** Turn on voice only when the person chose it: the browser's speech service may send audio away. */
  voice?: boolean;
}

export function AnalyticsChatPage({ agent, dataSource, library, sourceId, voice }: AnalyticsChatPageProps) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  useEffect(() => {
    void agent.describeAgents().then((r) => setAgents(r.agents));
  }, [agent]);
  const sessions = useMemo(() => librarySessions(library), [library]);
  const speech = useMemo(() => (voice ? browserSpeech() : undefined), [voice]);

  // Your own rule for files: here every file is named and refused, since this server reads only its own tables.
  const attachFiles = async (files: File[]): Promise<AttachResult[]> => files.map((file) => ({ file, error: "This server reads only its own tables." }));

  return (
    <DataSourceProvider dataSource={dataSource}>
      <AnalyticsChat
        agent={agent}
        agents={agents}
        sessions={sessions}
        attachFiles={attachFiles}
        browse={{ sourceId }}
        speech={speech}
        starters={["What tables are there?"]}
        height={640}
      />
    </DataSourceProvider>
  );
}
