import "server-only";

import { missingSetupMessage } from "@/lib/env";
import type { AgentAdapter } from "@/server/agents/types";

export class RealClaudeManagedAgentAdapter implements AgentAdapter {
  async run() {
    return {
      content: missingSetupMessage(
        "Claude Managed Agents 실제 API",
      ),
      anthropicSessionId: null,
      tokenUsage: { mode: "setup-required" },
      events: [
        {
          type: "real_adapter.setup_required",
          payload: {
            docs: "docs/ANTHROPIC_SETUP.md",
            betaHeader: process.env.ANTHROPIC_BETA_HEADER ?? "managed-agents-2026-04-01",
          },
        },
      ],
    };
  }
}
