import "server-only";

import { getServerEnv } from "@/lib/env";
import { RealClaudeManagedAgentAdapter } from "@/server/agents/claude-managed-agent-adapter";
import { MockAgentAdapter } from "@/server/agents/mock-agent-adapter";
import type { AgentAdapter } from "@/server/agents/types";

export function getAgentAdapter(): AgentAdapter {
  const env = getServerEnv();
  if (env.ANTHROPIC_API_KEY && env.ENABLE_REAL_AGENTS === "true") {
    return new RealClaudeManagedAgentAdapter();
  }
  return new MockAgentAdapter();
}
