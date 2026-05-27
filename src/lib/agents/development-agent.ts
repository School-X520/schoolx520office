import type { Agent } from "@/types/domain";

export const DEVELOPMENT_AGENT_ID = "development_bot";
export const DEVELOPMENT_AGENT_ROOM_ID = "development";

export function isDevelopmentAgent(agent: Pick<Agent, "id" | "roomId"> | null | undefined) {
  return agent?.id === DEVELOPMENT_AGENT_ID || agent?.roomId === DEVELOPMENT_AGENT_ROOM_ID;
}
