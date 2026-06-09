import "server-only";

import { AGENT_RUN_PROGRESS_EVENT, agentRunProgressPayload } from "@/server/agents/agent-run-activity";
import { mockStore } from "@/server/data/mock-store";
import type { AgentAdapter, AgentRunInput } from "@/server/agents/types";

export class MockAgentAdapter implements AgentAdapter {
  async run(input: AgentRunInput) {
    assertNotAborted(input);
    await input.onEvent?.({
      type: AGENT_RUN_PROGRESS_EVENT,
      payload: agentRunProgressPayload({
        key: "mock_review",
        title: "요청 검토",
        detail: "개발용 mock 봇이 응답 내용을 구성합니다.",
      }),
    });
    const agent = mockStore.getAgent(input.agentId);
    const room = mockStore.getRoom(input.guestSourceRoomId ?? input.roomId);
    const prefix =
      input.mode === "meeting_guest"
        ? `${agent?.name ?? "게스트 봇"}이 회의방에 잠시 입장했습니다.`
        : `${agent?.name ?? "업무 봇"} 응답입니다.`;

    const content = [
      prefix,
      `${room?.name ?? "해당 방"} 관점에서 요청을 검토했습니다.`,
      `요청: ${input.message}`,
      "다음 행동은 관련 자료를 공유 카드로 올리고, 결정사항이 생기면 할 일로 연결하는 것입니다.",
    ].join("\n");

    assertNotAborted(input);
    await input.onEvent?.({
      type: AGENT_RUN_PROGRESS_EVENT,
      payload: agentRunProgressPayload({
        key: "mock_answer",
        title: "응답 작성",
        detail: "채팅 답변을 준비했습니다.",
      }),
    });

    return {
      content,
      anthropicSessionId: null,
      tokenUsage: {
        mode: "mock",
        inputChars: input.message.length,
        outputChars: content.length,
      },
      events: [
        {
          type: "mock.completed",
          payload: { roomId: input.roomId, agentId: input.agentId },
        },
      ],
    };
  }
}

function assertNotAborted(input: AgentRunInput) {
  if (input.signal?.aborted) {
    throw new Error("봇 실행이 중단되었습니다.");
  }
}
