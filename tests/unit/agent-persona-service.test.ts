import { describe, expect, it } from "vitest";
import {
  buildAgentPersonaSystemPrompt,
  defaultAgentPersona,
  normalizeAgentPersona,
  publishRoomAgentPersona,
} from "@/server/agents/agent-persona-service";
import { mockUser } from "@/lib/mock-data";
import { mockStore } from "@/server/data/mock-store";

describe("agent persona service", () => {
  it("normalizes 담당자 persona input with existing agent defaults", () => {
    const agent = mockStore.getAgentByRoom("finance")!;
    const fallback = defaultAgentPersona(agent);
    const persona = normalizeAgentPersona(
      {
        role: "  예산 집행 근거를 먼저 확인하는 재무 담당 봇  ",
        tone: "",
        customInstructions: "x".repeat(3000),
      },
      fallback,
    );

    expect(persona.role).toBe("예산 집행 근거를 먼저 확인하는 재무 담당 봇");
    expect(persona.tone).toBe(fallback.tone);
    expect(persona.customInstructions).toHaveLength(2500);
    expect(persona.guestPrompt).toBe(fallback.guestPrompt);
  });

  it("builds a Claude Managed Agent system prompt from the published persona", () => {
    const agent = mockStore.getAgentByRoom("development")!;
    const prompt = buildAgentPersonaSystemPrompt(agent, {
      ...defaultAgentPersona(agent),
      role: "권한, 배포, 장애 대응을 우선하는 개발 담당 봇",
      tone: "근거와 위험을 먼저 말한다.",
      guestPrompt: "회의방에서는 차단 이슈와 다음 조치만 짧게 말한다.",
    });

    expect(prompt).toContain("담당자가 설정한 방별 페르소나");
    expect(prompt).toContain("권한, 배포, 장애 대응을 우선하는 개발 담당 봇");
    expect(prompt).toContain("School-X custom tools");
    expect(prompt).toContain("회의방에서는 차단 이슈와 다음 조치만 짧게 말한다.");
    expect(prompt).toContain("[School-X room id] development");
  });

  it("publishes persona locally when a mock agent has no Anthropic agent id", async () => {
    const agent = mockStore.getAgentByRoom("research")!;
    const persona = {
      ...defaultAgentPersona(agent),
      role: "연구 담당자가 직접 조정한 연구 분석 봇",
    };

    const result = await publishRoomAgentPersona(mockUser.userId, "research", persona);

    expect(result.publishStatus).toBe("local_only");
    expect(result.agent.personaPublished?.role).toBe("연구 담당자가 직접 조정한 연구 분석 봇");
    expect(result.skippedReason).toBe("anthropic_agent_id_missing");
  });
});
