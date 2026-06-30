import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileList } from "@/components/files/FileList";
import { OfficeFloorPlan } from "@/components/office/OfficeFloorPlan";
import { MeetingSidePanel } from "@/components/office/MeetingSidePanel";
import { RoomCard } from "@/components/office/RoomCard";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import { agents, memberships, rooms } from "@/lib/mock-data";
import type { FileRecord, MeetingImport, OperationStatusSnapshot, Room, SharedItem } from "@/types/domain";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cards", () => {
  it("renders room card", () => {
    const room: Room = {
      id: "meeting",
      name: "메인 회의방",
      type: "meeting",
      icon: "🏛️",
      description: "hub",
      displayOrder: 0,
      layoutX: 0,
      layoutY: 0,
      isActive: true,
      createdAt: "2026-05-08T00:00:00Z",
    };
    render(<RoomCard room={room} accessible />);
    expect(screen.getByText("메인 회의방")).toBeInTheDocument();
  });

  it("places the Gwangju-Hanam project room between Gyeonggi and Science Museum rooms", () => {
    render(<OfficeFloorPlan rooms={rooms.filter((room) => room.isActive)} agents={agents} memberships={memberships} />);

    const roomLinks = screen.getAllByRole("link").map((link) => link.textContent ?? "");
    const provinceIndex = roomLinks.findIndex((text) => text.includes("경기도교육연구회"));
    const gwangjuHanamIndex = roomLinks.findIndex((text) => text.includes("광주하남교육연구회"));
    const scienceMuseumIndex = roomLinks.findIndex((text) => text.includes("과학관 AI교육 연구회"));

    expect(provinceIndex).toBeGreaterThanOrEqual(0);
    expect(gwangjuHanamIndex).toBeGreaterThan(provinceIndex);
    expect(scienceMuseumIndex).toBeGreaterThan(gwangjuHanamIndex);
    expect(screen.getByText("광주하남봇 대기 중")).toBeInTheDocument();
  });

  it("renders shared and import cards", () => {
    const shared: SharedItem = {
      id: "s",
      sourceRoomId: "finance",
      sourceRoomName: "재무",
      targetRoomId: "meeting",
      title: "공유",
      summary: "요약",
      sharedBy: null,
      sourceMessageId: null,
      sourceFileId: null,
      createdAt: "2026-05-08T00:00:00Z",
      metadata: {},
    };
    const imported: MeetingImport = {
      id: "i",
      meetingRoomId: "meeting",
      targetRoomId: "research",
      sharedItemId: "s",
      sourceMessageId: null,
      sourceFileId: null,
      importedBy: null,
      status: "pending",
      createdAt: "2026-05-08T00:00:00Z",
      metadata: {},
    };
    render(
      <>
        <SharedItemCard item={shared} />
        <MeetingImportCard item={imported} />
      </>,
    );
    expect(screen.getByText("공유")).toBeInTheDocument();
    expect(screen.getByText("재무방에서 공유됨")).toBeInTheDocument();
    expect(screen.getByText("research 반입 항목")).toBeInTheDocument();
    expect(screen.getByLabelText("공유 공유 항목 삭제")).toBeInTheDocument();
    expect(screen.getByLabelText("research 반입 항목 반입 항목 삭제")).toBeInTheDocument();
  });

  it("does not add a room suffix to research association room names", () => {
    const shared: SharedItem = {
      id: "province-share",
      sourceRoomId: "province_research",
      sourceRoomName: "경기도교육연구회",
      targetRoomId: "meeting",
      title: "도교육 공유",
      summary: "요약",
      sharedBy: null,
      sourceMessageId: null,
      sourceFileId: null,
      createdAt: "2026-05-08T00:00:00Z",
      metadata: {},
    };

    render(<SharedItemCard item={shared} />);

    expect(screen.getByText("경기도교육연구회에서 공유됨")).toBeInTheDocument();
    expect(screen.queryByText("경기도교육연구회방에서 공유됨")).not.toBeInTheDocument();
  });

  it("opens a file-backed shared item's original through the local open workflow", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ filePath: "/tmp/schoolx/예산계획안.md" }));
    vi.stubGlobal("fetch", fetchMock);
    const shared: SharedItem = {
      id: "file-share",
      sourceRoomId: "finance",
      sourceRoomName: "재무",
      targetRoomId: "meeting",
      title: "예산 계획안",
      summary: "요약",
      sharedBy: null,
      sourceMessageId: null,
      sourceFileId: "file-1",
      createdAt: "2026-05-08T00:00:00Z",
      metadata: {},
    };

    render(<SharedItemCard item={shared} />);

    await userEvent.click(screen.getByRole("button", { name: "원본 보기" }));
    await userEvent.click(screen.getByRole("button", { name: "다운로드 후 열기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/shared-items/file-share/open-original",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ downloadDir: "~/Downloads/School-X" }),
        }),
      );
    });
    expect(await screen.findByText((content) => content.includes("/tmp/schoolx/예산계획안.md"))).toBeInTheDocument();
  });

  it("keeps meeting side-panel quick actions pointed at the meeting room and shows recent shares", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ meetings: [] })));
    const operationStatus: OperationStatusSnapshot = {
      sharedCount: 1,
      briefingCount: 2,
      taskCount: 3,
      updatedAt: "2026-06-24T06:00:00Z",
    };
    const shared: SharedItem = {
      id: "recent-share",
      sourceRoomId: "finance",
      sourceRoomName: "재무",
      targetRoomId: "meeting",
      title: "최근 공유",
      summary: "회의방에 표시되는 최근 공유 요약",
      sharedBy: null,
      sourceMessageId: null,
      sourceFileId: null,
      createdAt: "2026-05-08T00:00:00Z",
      metadata: {},
    };

    render(<MeetingSidePanel sharedItems={[shared]} activeMeeting={null} operationStatus={operationStatus} />);

    for (const label of ["봇 호출", "공유 작성", "작업 반입", "할 일 만들기"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) })).toHaveAttribute("href", "/rooms/meeting");
    }
    expect(screen.getByText("최근 공유")).toBeInTheDocument();
    expect(screen.getByText("회의방에 표시되는 최근 공유 요약")).toBeInTheDocument();
  });

  it("shares selected files to checked rooms from the file list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ rooms: [{ id: "research", name: "연구", type: "department", role: "member" }] }))
      .mockResolvedValueOnce(Response.json({ sharedItems: [{ id: "shared" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const files: FileRecord[] = [
      {
        id: "file-1",
        storagePath: "finance/file.md",
        originalName: "예산계획안.md",
        uploadedBy: null,
        sizeBytes: 2048,
        mimeType: "text/markdown",
        checksum: null,
        createdAt: "2026-05-08T00:00:00Z",
        versionNo: 1,
        accessLevel: "owner",
      },
    ];

    render(<FileList files={files} roomId="finance" />);

    const shareButton = screen.getByRole("button", { name: /다른 방에 공유하기/ });
    expect(shareButton).toBeDisabled();

    await userEvent.click(screen.getByLabelText("예산계획안.md 선택"));
    expect(shareButton).toBeEnabled();

    await userEvent.click(shareButton);
    await userEvent.click(await screen.findByLabelText("연구방 공유 대상 선택"));
    await userEvent.click(screen.getByRole("button", { name: "공유하기" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/files/share",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            sourceRoomId: "finance",
            sourceFileIds: ["file-1"],
            targetRoomIds: ["research"],
          }),
        }),
      );
    });
  });
});
