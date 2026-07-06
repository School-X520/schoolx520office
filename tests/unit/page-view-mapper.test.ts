import { describe, expect, it } from "vitest";

import { assembleOfficeDashboard, assembleRoomView } from "@/server/rooms/page-view";

const ISO = "2026-01-01T00:00:00+00:00";

function roomRow(id: string, name: string, isActive = true) {
  return {
    id,
    name,
    type: "department",
    icon: "💰",
    description: "",
    default_model: null,
    display_order: 1,
    layout_x: 0,
    layout_y: 0,
    is_active: isActive,
    created_at: ISO,
  };
}

describe("assembleRoomView", () => {
  const payload = {
    room: roomRow("finance", "재무"),
    membership: { user_id: "u1", room_id: "finance", role: "member", joined_at: ISO },
    threadNotFound: false,
    userMemberships: [
      { user_id: "u1", room_id: "finance", role: "member", joined_at: ISO },
      { user_id: "u1", room_id: "meeting", role: "observer", joined_at: ISO },
    ],
    rooms: [roomRow("finance", "재무"), roomRow("meeting", "메인 회의방"), roomRow("research", "연구")],
    agents: [
      {
        id: "finance-bot",
        room_id: "finance",
        name: "재무봇",
        role: "재무 담당",
        system_prompt: "",
        guest_prompt: "",
        default_model: "claude-sonnet-4-5",
        is_active: true,
        metadata: {},
        created_at: ISO,
        updated_at: ISO,
      },
    ],
    residentAgent: {
      id: "finance-bot",
      room_id: "finance",
      name: "재무봇",
      role: "재무 담당",
      system_prompt: "",
      guest_prompt: "",
      is_active: true,
      metadata: {},
      created_at: ISO,
      updated_at: ISO,
    },
    memory: {
      room_id: "finance",
      summary: "방 요약",
      active_tasks: [],
      decisions: [],
      key_facts: [],
      pending_context: [],
      processed_context: [],
      metadata: {},
      updated_at: ISO,
      updated_by_agent_run: null,
    },
    activeThread: {
      id: "11111111-1111-4111-8111-111111111111",
      room_id: "finance",
      title: "기본 대화",
      summary: "",
      carryover_summary: "",
      status: "active",
      last_message_at: ISO,
      created_by: null,
      created_at: ISO,
      updated_at: ISO,
      metadata: {},
    },
    threads: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        room_id: "finance",
        title: "기본 대화",
        status: "active",
        last_message_at: ISO,
        created_at: ISO,
        updated_at: ISO,
        metadata: {},
      },
    ],
    messages: [
      {
        id: "m1",
        room_id: "finance",
        thread_id: "11111111-1111-4111-8111-111111111111",
        sender_user_id: "u1",
        type: "human",
        content: "안녕하세요",
        metadata: {},
        created_at: ISO,
      },
    ],
    profiles: [
      { user_id: "u1", email: "a@b.com", display_name: "홍길동", is_admin: false, created_at: ISO, updated_at: ISO },
    ],
    files: [
      {
        id: "f1",
        storage_path: "finance/x.pdf",
        original_name: "x.pdf",
        size_bytes: 100,
        mime_type: "application/pdf",
        created_at: ISO,
        access_level: "write",
      },
    ],
    sharedItems: [
      { id: "s1", source_room_id: "finance", target_room_id: "meeting", title: "공유", summary: "", created_at: ISO, metadata: {} },
    ],
    imports: [],
    decisions: [{ id: "d1", room_id: "meeting", title: "결정", created_at: ISO }],
    tasks: [{ id: "tk1", room_id: "finance", title: "할일", status: "todo", created_at: ISO, updated_at: ISO, metadata: {} }],
    videoMeetings: [],
  };

  it("maps raw RPC rows into the RoomViewModel contract", () => {
    const view = assembleRoomView(payload, "u1", "finance");

    expect(view.room.id).toBe("finance");
    expect(view.room.name).toBe("재무");
    expect(view.membership?.role).toBe("member");
    expect(view.agent?.id).toBe("finance-bot");
    expect(view.memory.summary).toBe("방 요약");
    expect(view.messages).toHaveLength(1);
    expect(view.messages[0].content).toBe("안녕하세요");
    expect(view.decisions[0].id).toBe("d1");
    expect(view.tasks[0].id).toBe("tk1");
    expect(view.memberProfiles[0].displayName).toBe("홍길동");
  });

  it("flattens file_room_access access_level onto the file record", () => {
    const view = assembleRoomView(payload, "u1", "finance");
    expect(view.files[0].id).toBe("f1");
    expect(view.files[0].accessLevel).toBe("write");
  });

  it("resolves shared-item room names from the rooms payload", () => {
    const view = assembleRoomView(payload, "u1", "finance");
    expect(view.sharedItems[0].sourceRoomName).toBe("재무");
    expect(view.sharedItems[0].targetRoomName).toBe("메인 회의방");
  });

  it("derives writable task-target rooms from the user's memberships", () => {
    // finance=member(writable), meeting=observer(not) → 쓰기 가능한 비회의 활성방은 finance뿐.
    const view = assembleRoomView(payload, "u1", "finance");
    expect(view.taskTargetRooms.map((room) => room.id)).toEqual(["finance"]);
  });

  it("supplies a default memory object when the room has none", () => {
    const view = assembleRoomView({ ...payload, memory: null }, "u1", "finance");
    expect(view.memory.roomId).toBe("finance");
    expect(view.memory.summary).toBe("");
    expect(view.memory.activeTasks).toEqual([]);
  });
});

describe("assembleOfficeDashboard", () => {
  it("maps rooms, memberships, agents and ops counts", () => {
    const dashboard = assembleOfficeDashboard({
      rooms: [roomRow("finance", "재무"), roomRow("meeting", "메인 회의방")],
      memberships: [{ user_id: "u1", room_id: "finance", role: "member", joined_at: ISO }],
      agents: [],
      sharedItems: [{ id: "s1", source_room_id: "finance", target_room_id: "meeting", title: "공유", summary: "", created_at: ISO, metadata: {} }],
      videoMeetings: [],
      opsCounts: { sharedCount: 2, briefingCount: 1, taskCount: 3 },
    });

    expect(dashboard.rooms).toHaveLength(2);
    expect(dashboard.memberships[0].roomId).toBe("finance");
    expect(dashboard.sharedItems[0].id).toBe("s1");
    expect(dashboard.activeMeeting).toBeNull();
    expect(dashboard.operationStatus).toMatchObject({ sharedCount: 2, briefingCount: 1, taskCount: 3 });
  });
});
