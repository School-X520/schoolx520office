import type { Agent } from "@/types/domain";

export const DEVELOPMENT_AGENT_ID = "development_bot";
export const DEVELOPMENT_AGENT_ROOM_ID = "development";
export const COORDINATOR_AGENT_ID = "coordinator_bot";
export const COORDINATOR_AGENT_NAME = "총괄봇";

type AgentAccess = Pick<Agent, "id" | "roomId" | "metadata">;

export function isDevelopmentAgent(agent: Pick<Agent, "id" | "roomId"> | null | undefined) {
  return agent?.id === DEVELOPMENT_AGENT_ID || agent?.roomId === DEVELOPMENT_AGENT_ROOM_ID;
}

export function isCoordinatorAgent(agent: AgentAccess | null | undefined) {
  return agent?.id === COORDINATOR_AGENT_ID || agent?.metadata.coordinator_pm === true;
}

export function hasAllRoomSearchAccess(agent: AgentAccess | null | undefined) {
  return isDevelopmentAgent(agent) || isCoordinatorAgent(agent);
}

export function getCoordinatorAgent(): Agent {
  const now = "2026-05-08T00:00:00.000Z";
  return {
    id: COORDINATOR_AGENT_ID,
    roomId: "meeting",
    name: COORDINATOR_AGENT_NAME,
    role: "전체 업무방의 구조화 보고를 종합하는 운영 PM/회의 총괄 봇",
    anthropicAgentId: null,
    anthropicEnvironmentId: null,
    defaultModel: "claude-sonnet-4-5",
    systemPrompt:
      "School-X 교사연구회 AI Office의 총괄봇이다. 메인 회의방에서 호출될 때만 전체 업무방 보고를 종합하고, 운영 PM 관점의 진행 상황, 위험, 결정 필요 사항, 다음 행동을 간결하게 브리핑한다.",
    guestPrompt: "메인 회의방에서 전체 업무방 진행 상황을 운영 PM 관점으로 요약한다.",
    isActive: false,
    metadata: {
      coordinator_pm: true,
      all_room_search: true,
      virtual_agent: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}
