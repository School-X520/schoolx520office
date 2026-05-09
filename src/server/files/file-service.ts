import "server-only";

import { shouldUseMockData } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { requireRoomMember } from "@/server/auth/require-room-member";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._가-힣-]/g, "_");
}

export async function listRoomFiles(userId: string, roomId: string) {
  await requireRoomMember(userId, roomId);
  return shouldUseMockData() ? mockStore.listFiles(roomId) : supabaseStore.listFiles(roomId);
}

export async function uploadRoomFile(input: {
  userId: string;
  roomId: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  content?: Blob;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const month = new Date().toISOString().slice(0, 7);
  const fileId = crypto.randomUUID();
  const storagePath = `${input.roomId}/${month}/${fileId}-${safeName(input.originalName)}`;
  if (!shouldUseMockData() && input.content) {
    const admin = getSupabaseAdminClient();
    if (!admin) {
      throw new Error("Supabase service role is not configured.");
    }
    const { error } = await admin.storage.from("workspace-files").upload(storagePath, input.content, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
  const file = shouldUseMockData()
    ? mockStore.addFile({
        id: fileId,
        storagePath,
        originalName: input.originalName,
        uploadedBy: input.userId,
        sizeBytes: input.sizeBytes,
        mimeType: input.mimeType,
      })
    : await supabaseStore.addFile({
        roomId: input.roomId,
        storagePath,
        originalName: input.originalName,
        uploadedBy: input.userId,
        sizeBytes: input.sizeBytes,
        mimeType: input.mimeType,
      });
  const auditSource = shouldUseMockData() ? mockStore : supabaseStore;
  await auditSource.addAuditLog({
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
  const files = shouldUseMockData() ? mockStore.listFiles(input.roomId) : await supabaseStore.listFiles(input.roomId);
  const file = files.find((item) => item.id === input.fileId);
  if (!file) {
    throw new Error("파일을 찾을 수 없습니다.");
  }
  if (shouldUseMockData()) {
    return {
      file,
      signedUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(`${file.originalName} mock download`)}`,
    };
  }
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }
  const { data, error } = await admin.storage.from("workspace-files").createSignedUrl(file.storagePath, 300);
  if (error) {
    throw new Error(error.message);
  }
  return { file, signedUrl: data.signedUrl };
}

export async function createFileVersion(input: {
  userId: string;
  roomId: string;
  fileId: string;
  changeSummary: string;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const files = shouldUseMockData() ? mockStore.listFiles(input.roomId) : await supabaseStore.listFiles(input.roomId);
  const file = files.find((item) => item.id === input.fileId);
  if (!file) {
    throw new Error("파일을 찾을 수 없습니다.");
  }
  if (shouldUseMockData()) {
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
  const month = new Date().toISOString().slice(0, 7);
  const storagePath = `${input.roomId}/${month}/${input.fileId}-v${file.versionNo + 1}-${safeName(file.originalName)}`;
  const versioned = await supabaseStore.createFileVersion({
    fileId: input.fileId,
    storagePath,
    createdBy: input.userId,
    changeSummary: input.changeSummary,
  });
  await supabaseStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.versioned",
    targetType: "file",
    targetId: file.id,
    metadata: { changeSummary: input.changeSummary, versionNo: versioned.versionNo },
  });
  return versioned;
}
