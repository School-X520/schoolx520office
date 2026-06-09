import type {
  Agent,
  AllowedUser,
  DomainMemory,
  Room,
  RoomMembership,
  UserProfile,
} from "@/types/domain";

const now = "2026-05-08T00:00:00.000Z";

export const mockUser: UserProfile = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "devyongt@gmail.com",
  displayName: "총괄 관리자",
  avatarUrl: null,
  bio: "School-X 교사연구회 AI Office 운영을 총괄합니다.",
  isAdmin: true,
  createdAt: now,
  updatedAt: now,
};

export const rooms: Room[] = [
  {
    id: "meeting",
    name: "메인 회의방",
    type: "meeting",
    icon: "🏛️",
    description: "모든 팀원이 모이고, 각 방의 봇이 잠시 입장하는 협업 허브입니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 0,
    layoutX: 2,
    layoutY: 2,
    isActive: true,
    createdAt: now,
  },
  {
    id: "finance",
    name: "재무",
    type: "department",
    icon: "💰",
    description: "예산, 정산, 지출 근거와 비용 추적을 관리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 1,
    layoutX: 1,
    layoutY: 1,
    isActive: true,
    createdAt: now,
  },
  {
    id: "planning",
    name: "기획",
    type: "department",
    icon: "📋",
    description: "운영 일정, 회의 안건, 과제 로드맵을 정리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 2,
    layoutX: 2,
    layoutY: 1,
    isActive: true,
    createdAt: now,
  },
  {
    id: "external",
    name: "대외협력",
    type: "department",
    icon: "🤝",
    description: "기관 협의, 공문, 협력 제안 흐름을 관리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 3,
    layoutX: 3,
    layoutY: 1,
    isActive: true,
    createdAt: now,
  },
  {
    id: "development",
    name: "개발",
    type: "department",
    icon: "💻",
    description: "권한, DB, 운영, 오류 대응, 비용과 로그를 관리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 4,
    layoutX: 1,
    layoutY: 3,
    isActive: true,
    createdAt: now,
  },
  {
    id: "research",
    name: "연구",
    type: "department",
    icon: "🔬",
    description: "교육과정 분석, 수업 연구, 자료 분석과 루브릭을 다룹니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 5,
    layoutX: 2,
    layoutY: 3,
    isActive: true,
    createdAt: now,
  },
  {
    id: "promotion",
    name: "홍보",
    type: "department",
    icon: "📣",
    description: "발표자료, 홍보 문안, 시각화 산출물을 만듭니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 6,
    layoutX: 3,
    layoutY: 3,
    isActive: true,
    createdAt: now,
  },
  {
    id: "city_research",
    name: "비활성 프로젝트방",
    type: "project",
    icon: "🏫",
    description: "향후 재사용을 위해 비활성화된 프로젝트 방입니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 7,
    layoutX: 1,
    layoutY: 4,
    isActive: false,
    createdAt: now,
  },
  {
    id: "province_research",
    name: "경기도교육연구회",
    type: "project",
    icon: "🏢",
    description: "경기도교육연구회 산출물과 협의 내용을 관리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 8,
    layoutX: 1,
    layoutY: 4,
    isActive: true,
    createdAt: now,
  },
  {
    id: "gwangju_hanam_research",
    name: "광주하남교육연구회",
    type: "project",
    icon: "🏫",
    description: "광주하남교육연구회 산출물과 협의 내용을 관리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 9,
    layoutX: 2,
    layoutY: 4,
    isActive: true,
    createdAt: now,
  },
  {
    id: "science_museum",
    name: "과학관 AI교육 연구회",
    type: "project",
    icon: "🔭",
    description: "과학관 AI교육 연구회 운영, 협력 과제, 전시/체험 자료를 정리합니다.",
    defaultModel: "claude-sonnet-4-5",
    displayOrder: 10,
    layoutX: 3,
    layoutY: 4,
    isActive: true,
    createdAt: now,
  },
];

const botNames: Record<string, string> = {
  finance: "재무봇",
  planning: "기획봇",
  external: "대외협력봇",
  development: "개발봇",
  research: "연구봇",
  promotion: "홍보봇",
  city_research: "예비봇",
  province_research: "도교육봇",
  gwangju_hanam_research: "광주하남봇",
  science_museum: "과학관봇",
};

const developmentBotRole =
  "모든 업무방에 상주하며 담당자와 도메인 봇의 대화를 바탕으로 School-X 교사연구회 플랫폼 개선안을 제안하는 개발 봇";

const developmentBotSystemPrompt = [
  "School-X 교사연구회 AI Office의 개발봇이다.",
  "모든 업무방의 담당자와 도메인 봇 대화를 관찰 가능한 프로젝트 맥락으로 읽고, 시스템을 더 잘 개발할 방법을 제안한다.",
  "각 방의 업무 흐름, 반복되는 불편, 필요한 자동화, 데이터 구조 개선, 권한/보안 리스크, UI 개선점을 찾아 실행 가능한 개발 계획으로 정리한다.",
  "전체 프로젝트 진행 상황을 요약하고, 방별 이슈와 공통 병목을 구분해 보고한다.",
  "학생 개인정보와 민감정보는 최소한으로 다루고, 개선 제안에는 필요한 근거와 영향을 함께 적는다.",
].join(" ");

const developmentBotGuestPrompt =
  "어느 방에서 호출되든 플랫폼 개선 관점으로 현재 논의의 시스템화 가능성, 개발 작업 후보, 전체 프로젝트 영향만 짧게 제안한다.";

export const agents: Agent[] = rooms
  .filter((room) => room.id !== "meeting" && room.isActive)
  .map((room) => ({
    id: `${room.id}_bot`,
    roomId: room.id,
    name: botNames[room.id],
    role: room.id === "development" ? developmentBotRole : `${room.name} 업무를 총괄하는 도메인 봇`,
    anthropicAgentId: null,
    anthropicEnvironmentId: null,
    defaultModel: room.defaultModel ?? "claude-sonnet-4-5",
    systemPrompt:
      room.id === "development"
        ? developmentBotSystemPrompt
        : `${room.name} 업무를 총괄한다. 개인정보와 민감정보를 무단 공유하지 않고, 불확실한 내용은 확인 질문으로 남긴다.`,
    guestPrompt:
      room.id === "development"
        ? developmentBotGuestPrompt
        : "회의방에서는 5문장 이내로 출처와 다음 행동을 포함해 브리핑한다.",
    isActive: true,
    metadata: room.id === "development" ? { global_room_observer: true } : {},
    createdAt: now,
    updatedAt: now,
  }));

export const allowedUsers: AllowedUser[] = [
  {
    email: mockUser.email,
    invitedBy: null,
    invitedAt: now,
    notes: "Initial School-X administrator.",
    isActive: true,
    isAdmin: true,
  },
];

export const memberships: RoomMembership[] = rooms.map((room) => ({
  userId: mockUser.userId,
  roomId: room.id,
  role: "admin",
  joinedAt: now,
}));

export const baseMemories: DomainMemory[] = rooms.map((room) => ({
  roomId: room.id,
  summary:
    room.id === "meeting"
      ? "회의방은 공유 카드, 게스트 봇 브리핑, 결정사항, 화상회의 결과물을 모으는 허브입니다."
      : `${room.name} 방은 아직 실제 데이터 연결 전이며 mock 요약으로 표시됩니다.`,
  activeTasks: [],
  decisions: [],
  keyFacts: [],
  pendingContext: [],
  processedContext: [],
  metadata: {},
  updatedAt: now,
  updatedByAgentRun: null,
}));
