import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RoomCard } from "@/components/office/RoomCard";
import { SharedItemCard } from "@/components/meeting/SharedItemCard";
import { MeetingImportCard } from "@/components/meeting/MeetingImportCard";
import type { MeetingImport, Room, SharedItem } from "@/types/domain";

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
  });
});
