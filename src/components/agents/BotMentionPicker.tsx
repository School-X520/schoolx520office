"use client";

import type { Agent } from "@/types/domain";

export function BotMentionPicker({ agents }: { agents: Agent[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-soft hover:bg-gold-soft"
        >
          @{agent.name}
        </button>
      ))}
    </div>
  );
}
