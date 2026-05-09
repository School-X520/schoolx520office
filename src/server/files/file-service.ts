import "server-only";

import { mockStore } from "@/server/data/mock-store";
import { requireRoomMember } from "@/server/auth/require-room-member";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._가-힣-]/g, "_");
}

export async function listRoomFiles(userId: string, roomId: string) {
  await requireRoomMember(userId, roomId);
  return mockStore.listFiles(roomId);
}

export async function uploadRoomFile(input: {
  userId: string;
  roomId: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const month = new Date().toISOString().slice(0, 7);
  const fileId = crypto.randomUUID();
  const file = mockStore.addFile({
    id: fileId,
    storagePath: `${input.roomId}/${month}/${fileId}-${safeName(input.originalName)}`,
    originalName: input.originalName,
    uploadedBy: input.userId,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
  });
  mockStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.uploaded",
    targetType: "file",
    targetId: file.id,
  });
  return file;
}

export async function createSignedDownloadUrl(input: { userId: string; roomId: string; fileId: string }) {
  await requireRoomMember(input.userId, input.roomId);
  const file = mockStore.listFiles(input.roomId).find((item) => item.id === input.fileId);
  if (!file) {
    throw new Error("파일을 찾을 수 없습니다.");
  }
  return {
    file,
    signedUrl: `/api/files/${file.id}/download?mock=1`,
  };
}

export async function createFileVersion(input: {
  userId: string;
  roomId: string;
  fileId: string;
  changeSummary: string;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const file = mockStore.listFiles(input.roomId).find((item) => item.id === input.fileId);
  if (!file) {
    throw new Error("파일을 찾을 수 없습니다.");
  }
  file.versionNo += 1;
  mockStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.versioned",
    targetType: "file",
    targetId: file.id,
    metadata: { changeSummary: input.changeSummary, versionNo: file.versionNo },
  });
  return file;
}
