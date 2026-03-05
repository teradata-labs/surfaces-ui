/** Message from Loom's ConversationHistory. */
export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  timestamp: string;
  toolName?: string;
}

/** Session metadata from Loom's ListSessions. */
export interface SessionSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  state: string;
  totalCostUsd?: number;
  conversationCount?: number;
  agentId?: string;
}

/** Response shape from Loom's GetConversationHistory. */
export interface ConversationHistoryResponse {
  sessionId: string;
  messages: ConversationMessage[];
  totalCount?: number;
}

/** Response shape from Loom's ListSessions. */
export interface ListSessionsResponse {
  sessions: SessionSummary[];
}
