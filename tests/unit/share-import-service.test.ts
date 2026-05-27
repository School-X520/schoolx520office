import { describe, expect, it } from "vitest";
import { mockUser } from "@/lib/mock-data";
import {
  applyMeetingImportToBotMemory,
  createTaskFromMeetingImport,
  shareMessageToMeeting,
  importMeetingMessageToRoom,
} from "@/server/collaboration/share-import-service";
import { mockStore } from "@/server/data/mock-store";

describe("share/import service", () => {
  it("keeps the source room display name and copies shared files into target work rooms", async () => {
    const sourceFile = mockStore.addFile({
      storagePath: "finance/2026-05/budget-plan.md",
      originalName: "예산계획안.md",
      uploadedBy: mockUser.userId,
      sizeBytes: 2048,
      mimeType: "text/markdown",
    });

    const sharedItem = await shareMessageToMeeting({
      userId: mockUser.userId,
      sourceRoomId: "finance",
      sourceFileId: sourceFile.id,
      title: "예산계획안",
      summary: "재무방 예산계획안 공유",
    });

    expect(sharedItem.metadata.sourceRoomName).toBe("재무");

    const meetingImport = await importMeetingMessageToRoom({
      userId: mockUser.userId,
      targetRoomId: "research",
      sharedItemId: sharedItem.id,
    });

    const copiedFileId = String(meetingImport.metadata.copiedFileId);
    const copiedFile = mockStore.listFiles("research").find((file) => file.id === copiedFileId);

    expect(meetingImport.sourceFileId).toBe(copiedFileId);
    expect(meetingImport.metadata.originalSourceFileId).toBe(sourceFile.id);
    expect(copiedFile?.originalName).toBe("예산계획안.md");
    expect(copiedFile?.storagePath).toContain("research/");
  });

  it("applies meeting imports to bot memory by clearing pending context", async () => {
    const sharedItem = await shareMessageToMeeting({
      userId: mockUser.userId,
      sourceRoomId: "planning",
      title: "운영 일정",
      summary: "개발방에서 참고할 운영 일정",
    });
    const meetingImport = await importMeetingMessageToRoom({
      userId: mockUser.userId,
      targetRoomId: "development",
      sharedItemId: sharedItem.id,
    });

    expect(mockStore.getMemory("development")?.pendingContext).toEqual(
      expect.arrayContaining([expect.objectContaining({ meetingImportId: meetingImport.id })]),
    );

    const result = await applyMeetingImportToBotMemory({
      userId: mockUser.userId,
      importId: meetingImport.id,
    });

    expect(result.meetingImport?.status).toBe("processed");
    expect(mockStore.getMemory("development")?.pendingContext).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ meetingImportId: meetingImport.id })]),
    );
    expect(mockStore.getMemory("development")?.processedContext).toEqual(
      expect.arrayContaining([expect.objectContaining({ meetingImportId: meetingImport.id })]),
    );
  });

  it("creates a task from a meeting import and clears its pending context", async () => {
    const sharedItem = await shareMessageToMeeting({
      userId: mockUser.userId,
      sourceRoomId: "research",
      title: "PDF 읽기 오류 개선",
      summary: "개발방에서 PDF 읽기 오류를 확인해야 함",
    });
    const meetingImport = await importMeetingMessageToRoom({
      userId: mockUser.userId,
      targetRoomId: "development",
      sharedItemId: sharedItem.id,
    });

    const result = await createTaskFromMeetingImport({
      userId: mockUser.userId,
      importId: meetingImport.id,
    });

    expect(result.meetingImport?.status).toBe("processed");
    expect(result.task.title).toBe("PDF 읽기 오류 개선");
    expect(mockStore.listTasks("development").map((task) => task.id)).toContain(result.task.id);
    expect(mockStore.getMemory("development")?.pendingContext).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ meetingImportId: meetingImport.id })]),
    );
  });
});
