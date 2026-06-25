import { describe, expect, it } from "vitest";

import { mockUser } from "@/lib/mock-data";
import { mockStore } from "@/server/data/mock-store";
import { createFileVersion, createSignedDownloadUrl, uploadRoomFile } from "@/server/files/file-service";

describe("uploadRoomFile 업로드 제한", () => {
  it("실행 파일 확장자를 415로 거부한다", async () => {
    await expect(
      uploadRoomFile({
        userId: mockUser.userId,
        roomId: "research",
        originalName: "malware.exe",
        sizeBytes: 1024,
        mimeType: "application/octet-stream",
      }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it("대소문자가 섞인 실행 확장자도 거부한다", async () => {
    await expect(
      uploadRoomFile({
        userId: mockUser.userId,
        roomId: "research",
        originalName: "Setup.MSI",
        sizeBytes: 1024,
        mimeType: "application/octet-stream",
      }),
    ).rejects.toMatchObject({ status: 415 });
  });

  it("크기 상한을 초과하면 413으로 거부한다", async () => {
    await expect(
      uploadRoomFile({
        userId: mockUser.userId,
        roomId: "research",
        originalName: "big.pdf",
        sizeBytes: 60 * 1024 * 1024,
        mimeType: "application/pdf",
      }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("정상 문서는 업로드된다", async () => {
    const file = await uploadRoomFile({
      userId: mockUser.userId,
      roomId: "research",
      originalName: "연구계획서.pdf",
      sizeBytes: 1024,
      mimeType: "application/pdf",
    });
    expect(file.originalName).toBe("연구계획서.pdf");
  });

  it("mock mode creates a signed download URL for an accessible room file", async () => {
    const file = mockStore.addFile({
      storagePath: "finance/test-download.md",
      originalName: "다운로드테스트.md",
      uploadedBy: mockUser.userId,
      sizeBytes: 120,
      mimeType: "text/markdown",
    });

    const result = await createSignedDownloadUrl({ userId: mockUser.userId, roomId: "finance", fileId: file.id });

    expect(result.file.id).toBe(file.id);
    expect(result.signedUrl).toContain(encodeURIComponent("다운로드테스트.md mock download"));
  });

  it("increments file versions and records an audit log", async () => {
    const file = mockStore.addFile({
      storagePath: "research/version-test.md",
      originalName: "버전테스트.md",
      uploadedBy: mockUser.userId,
      sizeBytes: 120,
      mimeType: "text/markdown",
    });

    const versioned = await createFileVersion({
      userId: mockUser.userId,
      roomId: "research",
      fileId: file.id,
      changeSummary: "문구 수정",
    });

    expect(versioned.versionNo).toBe(2);
    expect(
      mockStore.listAuditLogs().some((log) => log.action === "file.versioned" && log.targetId === file.id),
    ).toBe(true);
  });
});
