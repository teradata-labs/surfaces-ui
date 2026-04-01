/**
 * AgentFlowView types
 */

import type { AgentStatus } from '../../molecules/agent-node';

export interface AgentStep {
  /** Unique step identifier */
  id: string;
  /** Display name for the agent */
  name: string;
  /** Agent identifier */
  agentId: string;
  /** Current execution status */
  status: AgentStatus;
  /** Ordinal step number */
  stepNumber: number;
  /** IDs of steps this step depends on */
  dependsOn?: string[];
}
