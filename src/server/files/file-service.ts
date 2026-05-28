import "server-only";

import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { shouldUseMockData } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getManagedAgentsClientFromEnv, type AnthropicFileMetadata } from "@/lib/anthropic/managed-agents-api";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";
import { canWriteRoom, requireRoomMember } from "@/server/auth/require-room-member";
import type { FileRecord } from "@/types/domain";

const WORKSPACE_FILES_BUCKET = "workspace-files";
const DEFAULT_AGENT_MOUNT_FILE_LIMIT = 20;
const DEFAULT_AGENT_MOUNT_MAX_FILE_BYTES = 25 * 1024 * 1024;
const DEFAULT_READ_FILE_MAX_CHARS = 16_000;
const MAX_READ_FILE_BYTES = 20 * 1024 * 1024;
const execFileAsync = promisify(execFile);

export type MountedAgentFile = {
  roomId: string;
  fileId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  anthropicFileId: string;
  mountPath: string;
};

function safeName(name: string) {
  const extension = name.match(/\.[a-zA-Z0-9]{1,12}$/)?.[0] ?? "";
  const safe = name
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return safe || `file${extension || ".txt"}`;
}

function displayFileName(name: string) {
  return name.split("/").filter(Boolean).pop()?.replace(/[\r\n]/g, "_").trim() || "agent-file.txt";
}

function localFileName(name: string) {
  return displayFileName(name).replace(/[/:\\]/g, "_");
}

export function agentFileMountPath(roomId: string, file: Pick<FileRecord, "id" | "originalName">) {
  return `/workspace/schoolx-files/${safeName(roomId)}/${file.id}-${safeName(file.originalName)}`;
}

export async function listRoomFiles(userId: string, roomId: string) {
  await requireRoomMember(userId, roomId);
  return shouldUseMockData() ? mockStore.listFiles(roomId) : supabaseStore.listFiles(roomId);
}

export async function readRoomFileForAgent(input: {
  userId: string;
  roomId: string;
  fileId?: string | null;
  filename?: string | null;
  maxChars?: number | null;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const files = shouldUseMockData() ? mockStore.listFiles(input.roomId) : await supabaseStore.listFiles(input.roomId);
  const normalizedFilename = input.filename?.trim().toLowerCase();
  const file = files.find((item) => item.id === input.fileId) ?? files.find((item) => item.originalName.toLowerCase() === normalizedFilename);
  if (!file) {
    throw statusError("파일을 찾을 수 없습니다.", 404);
  }
  if (file.sizeBytes > MAX_READ_FILE_BYTES) {
    return {
      file: compactFile(file),
      contentAvailable: false,
      reason: `파일이 ${Math.round(file.sizeBytes / 1024 / 1024)}MB로 너무 큽니다. ${Math.round(MAX_READ_FILE_BYTES / 1024 / 1024)}MB 이하 파일만 직접 읽을 수 있습니다.`,
    };
  }
  if (shouldUseMockData()) {
    return {
      file: compactFile(file),
      contentAvailable: true,
      content: `${file.originalName} mock file content`,
      truncated: false,
      extraction: "mock",
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }
  const { data, error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).download(file.storagePath);
  if (error) {
    throw new Error(`파일 다운로드 실패(${file.originalName}): ${error.message}`);
  }

  const bytes = await data.arrayBuffer();
  const extracted = await extractReadableText(file, bytes);
  const maxChars = Math.min(Math.max(input.maxChars ?? DEFAULT_READ_FILE_MAX_CHARS, 1000), 30_000);
  const content = extracted.text.slice(0, maxChars);
  const truncated = extracted.text.length > content.length;
  await supabaseStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.read_by_agent_tool",
    targetType: "file",
    targetId: file.id,
    metadata: {
      originalName: file.originalName,
      extraction: extracted.extraction,
      truncated,
      returnedChars: content.length,
    },
  });

  return {
    file: compactFile(file),
    contentAvailable: Boolean(content.trim()),
    content,
    truncated,
    extraction: extracted.extraction,
    totalChars: extracted.text.length,
  };
}

export async function deleteRoomFile(input: { userId: string; roomId: string; fileId: string }) {
  const membership = await requireRoomMember(input.userId, input.roomId);
  if (!canWriteRoom(membership.role)) {
    throw statusError("파일을 삭제할 권한이 없습니다.", 403);
  }
  const files = shouldUseMockData() ? mockStore.listFiles(input.roomId) : await supabaseStore.listFiles(input.roomId);
  const file = files.find((item) => item.id === input.fileId);
  if (!file) {
    throw statusError("파일을 찾을 수 없습니다.", 404);
  }
  if (shouldUseMockData()) {
    mockStore.removeFileFromRoom(input.roomId, input.fileId);
    return file;
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }
  const { error } = await admin.from("file_room_access").delete().eq("file_id", input.fileId).eq("room_id", input.roomId);
  if (error) {
    throw new Error(error.message);
  }

  await cleanupUnreferencedFile(input.fileId, file);
  await supabaseStore.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.removed_from_room",
    targetType: "file",
    targetId: file.id,
    metadata: {
      originalName: file.originalName,
      storagePath: file.storagePath,
    },
  });
  return file;
}

export async function uploadRoomFile(input: {
  userId: string;
  roomId: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  content?: Blob;
  agentRunId?: string | null;
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
    const { error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).upload(storagePath, input.content, {
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
        agentRunId: input.agentRunId,
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

export async function prepareAnthropicSessionFileResources(input: {
  userId: string;
  roomIds: string[];
  maxFiles?: number;
  maxFileBytes?: number;
}) {
  if (shouldUseMockData()) {
    return [];
  }

  const roomIds = [...new Set(input.roomIds.filter(Boolean))];
  for (const roomId of roomIds) {
    await requireRoomMember(input.userId, roomId);
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const filesById = new Map<string, MountedAgentFile & { createdAt: string }>();
  for (const roomId of roomIds) {
    const files = await supabaseStore.listFiles(roomId);
    for (const file of files) {
      const existing = filesById.get(file.id);
      if (existing) {
        continue;
      }
      filesById.set(file.id, {
        roomId,
        fileId: file.id,
        originalName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        storagePath: file.storagePath,
        anthropicFileId: "",
        mountPath: agentFileMountPath(roomId, file),
        createdAt: file.createdAt,
      });
    }
  }

  const maxFiles = input.maxFiles ?? DEFAULT_AGENT_MOUNT_FILE_LIMIT;
  const maxFileBytes = input.maxFileBytes ?? DEFAULT_AGENT_MOUNT_MAX_FILE_BYTES;
  const mountCandidates = [...filesById.values()]
    .filter((file) => file.sizeBytes <= maxFileBytes)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, maxFiles);

  const client = getManagedAgentsClientFromEnv();
  const mountedFiles: MountedAgentFile[] = [];

  for (const file of mountCandidates) {
    const { data, error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).download(file.storagePath);
    if (error) {
      throw new Error(`파일 다운로드 실패(${file.originalName}): ${error.message}`);
    }

    const uploaded = await client.uploadFile({
      filename: displayFileName(file.originalName),
      bytes: await data.arrayBuffer(),
      mimeType: file.mimeType,
    });

    mountedFiles.push({
      roomId: file.roomId,
      fileId: file.fileId,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      storagePath: file.storagePath,
      anthropicFileId: uploaded.id,
      mountPath: file.mountPath,
    });
  }

  return mountedFiles;
}

export async function importAnthropicSessionFiles(input: {
  userId: string;
  roomId: string;
  agentId: string;
  agentRunId: string;
  anthropicSessionId: string;
  excludedSourceFiles?: Array<{
    anthropicFileId: string;
    originalName: string;
    sizeBytes: number;
    mimeType?: string | null;
    mountPath?: string | null;
  }>;
}) {
  if (shouldUseMockData()) {
    return [];
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const client = getManagedAgentsClientFromEnv();
  const sessionFiles = await client.listSessionFiles(input.anthropicSessionId);
  const downloadableFiles = sessionFiles.filter(
    (file) => file.downloadable !== false && !isMountedSourceFile(file, input.excludedSourceFiles ?? []),
  );
  const importedFiles: FileRecord[] = [];

  for (const sessionFile of downloadableFiles) {
    const downloaded = await client.downloadFile(sessionFile.id);
    const originalName = displayFileName(sessionFile.filename || `${sessionFile.id}.txt`);
    const mimeType = sessionFile.mime_type || downloaded.contentType || "application/octet-stream";
    const storagePath = agentGeneratedStoragePath(input.roomId, input.agentRunId, originalName);

    const { error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).upload(storagePath, new Blob([downloaded.bytes], { type: mimeType }), {
      contentType: mimeType,
      upsert: false,
    });
    if (error) {
      throw new Error(error.message);
    }

    const file = await supabaseStore.addFile({
      roomId: input.roomId,
      storagePath,
      originalName,
      uploadedBy: input.userId,
      sizeBytes: sessionFile.size_bytes ?? downloaded.bytes.byteLength,
      mimeType,
      agentRunId: input.agentRunId,
    });

    await supabaseStore.addAuditLog({
      actorUserId: input.userId,
      actorAgentId: input.agentId,
      roomId: input.roomId,
      action: "file.agent_imported",
      targetType: "file",
      targetId: file.id,
      metadata: {
        agentRunId: input.agentRunId,
        anthropicSessionId: input.anthropicSessionId,
        anthropicFileId: sessionFile.id,
        originalName,
        source: anthropicFileMetadata(sessionFile),
      },
    });

    importedFiles.push(file);
  }

  return importedFiles;
}

export async function saveAgentGeneratedTextFile(input: {
  userId: string;
  roomId: string;
  agentId: string;
  agentRunId: string;
  originalName: string;
  content: string;
  mimeType?: string;
  source?: Record<string, unknown>;
}) {
  if (shouldUseMockData()) {
    return mockStore.addFile({
      storagePath: agentGeneratedStoragePath(input.roomId, input.agentRunId, input.originalName),
      originalName: input.originalName,
      uploadedBy: input.userId,
      sizeBytes: new Blob([input.content]).size,
      mimeType: input.mimeType ?? guessMimeType(input.originalName),
    });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }

  const mimeType = input.mimeType ?? guessMimeType(input.originalName);
  const storagePath = agentGeneratedStoragePath(input.roomId, input.agentRunId, input.originalName);
  const content = new Blob([input.content], { type: mimeType });
  const { error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).upload(storagePath, content, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    throw new Error(error.message);
  }

  const file = await supabaseStore.addFile({
    roomId: input.roomId,
    storagePath,
    originalName: input.originalName,
    uploadedBy: input.userId,
    sizeBytes: content.size,
    mimeType,
    agentRunId: input.agentRunId,
  });

  await supabaseStore.addAuditLog({
    actorUserId: input.userId,
    actorAgentId: input.agentId,
    roomId: input.roomId,
    action: "file.agent_generated",
    targetType: "file",
    targetId: file.id,
    metadata: {
      agentRunId: input.agentRunId,
      originalName: input.originalName,
      source: input.source ?? {},
    },
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
  const { data, error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).createSignedUrl(file.storagePath, 300, {
    download: file.originalName,
  });
  if (error) {
    throw new Error(error.message);
  }
  return { file, signedUrl: data.signedUrl };
}

export function defaultLocalDownloadDir() {
  return path.join(os.homedir(), "Downloads", "School-X");
}

export async function downloadRoomFileToLocalAndOpen(input: {
  userId: string;
  roomId: string;
  fileId: string;
  downloadDir?: string | null;
}) {
  await requireRoomMember(input.userId, input.roomId);
  const files = shouldUseMockData() ? mockStore.listFiles(input.roomId) : await supabaseStore.listFiles(input.roomId);
  const file = files.find((item) => item.id === input.fileId);
  if (!file) {
    throw statusError("파일을 찾을 수 없습니다.", 404);
  }

  const downloadDir = resolveLocalDownloadDir(input.downloadDir);
  await mkdir(downloadDir, { recursive: true });
  const filePath = await uniqueLocalFilePath(downloadDir, localFileName(file.originalName));
  const bytes = shouldUseMockData()
    ? Buffer.from(`${file.originalName} mock download`, "utf-8")
    : Buffer.from(await downloadStoredFileBytes(file));
  await writeFile(filePath, bytes);
  await openLocalFile(filePath);

  const auditSource = shouldUseMockData() ? mockStore : supabaseStore;
  await auditSource.addAuditLog({
    actorUserId: input.userId,
    roomId: input.roomId,
    action: "file.opened_locally",
    targetType: "file",
    targetId: file.id,
    metadata: { filePath, originalName: file.originalName },
  });

  return { file, filePath, downloadDir };
}

export async function copyRoomFileToRoom(input: {
  userId: string;
  sourceRoomId: string;
  sourceFileId: string;
  targetRoomId: string;
}) {
  await requireRoomMember(input.userId, input.sourceRoomId);
  const targetMembership = await requireRoomMember(input.userId, input.targetRoomId);
  if (!canWriteRoom(targetMembership.role)) {
    throw statusError("파일을 가져올 권한이 없습니다.", 403);
  }

  const sourceFiles = shouldUseMockData()
    ? mockStore.listFiles(input.sourceRoomId)
    : await supabaseStore.listFiles(input.sourceRoomId);
  const sourceFile = sourceFiles.find((file) => file.id === input.sourceFileId);
  if (!sourceFile) {
    throw statusError("가져올 원본 파일을 찾을 수 없습니다.", 404);
  }

  const storagePath = copiedStoragePath(input.targetRoomId, sourceFile.originalName);
  const copiedFile = shouldUseMockData()
    ? mockStore.addFile({
        storagePath,
        originalName: sourceFile.originalName,
        uploadedBy: input.userId,
        sizeBytes: sourceFile.sizeBytes,
        mimeType: sourceFile.mimeType,
        checksum: sourceFile.checksum ?? null,
        accessLevel: "owner",
      })
    : await copyStoredFileToRoom({
        userId: input.userId,
        targetRoomId: input.targetRoomId,
        sourceFile,
        storagePath,
      });

  const auditSource = shouldUseMockData() ? mockStore : supabaseStore;
  await auditSource.addAuditLog({
    actorUserId: input.userId,
    roomId: input.targetRoomId,
    action: "file.copied_from_meeting",
    targetType: "file",
    targetId: copiedFile.id,
    metadata: {
      sourceRoomId: input.sourceRoomId,
      sourceFileId: input.sourceFileId,
      originalName: sourceFile.originalName,
    },
  });

  return copiedFile;
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

function agentGeneratedStoragePath(roomId: string, agentRunId: string, originalName: string) {
  const month = new Date().toISOString().slice(0, 7);
  return `${roomId}/${month}/agent-runs/${agentRunId}/${crypto.randomUUID()}-${safeName(originalName)}`;
}

function copiedStoragePath(roomId: string, originalName: string) {
  const month = new Date().toISOString().slice(0, 7);
  return `${roomId}/${month}/meeting-imports/${crypto.randomUUID()}-${safeName(originalName)}`;
}

async function copyStoredFileToRoom(input: {
  userId: string;
  targetRoomId: string;
  sourceFile: FileRecord;
  storagePath: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }
  const bytes = await downloadStoredFileBytes(input.sourceFile);
  const { error } = await admin.storage
    .from(WORKSPACE_FILES_BUCKET)
    .upload(input.storagePath, new Blob([bytes], { type: input.sourceFile.mimeType }), {
      contentType: input.sourceFile.mimeType,
      upsert: false,
    });
  if (error) {
    throw new Error(error.message);
  }

  return supabaseStore.addFile({
    roomId: input.targetRoomId,
    storagePath: input.storagePath,
    originalName: input.sourceFile.originalName,
    uploadedBy: input.userId,
    sizeBytes: input.sourceFile.sizeBytes,
    mimeType: input.sourceFile.mimeType,
    checksum: input.sourceFile.checksum ?? null,
  });
}

async function downloadStoredFileBytes(file: FileRecord) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    throw new Error("Supabase service role is not configured.");
  }
  const { data, error } = await admin.storage.from(WORKSPACE_FILES_BUCKET).download(file.storagePath);
  if (error) {
    throw new Error(`파일 다운로드 실패(${file.originalName}): ${error.message}`);
  }
  return data.arrayBuffer();
}

function resolveLocalDownloadDir(value?: string | null) {
  const raw = value?.trim() || defaultLocalDownloadDir();
  const expanded = raw === "~" ? os.homedir() : raw.startsWith("~/") ? path.join(os.homedir(), raw.slice(2)) : raw;
  const resolved = path.resolve(expanded);
  if (!path.isAbsolute(resolved)) {
    throw statusError("다운로드 폴더는 절대 경로로 지정해 주세요.", 400);
  }
  return resolved;
}

async function uniqueLocalFilePath(downloadDir: string, filename: string) {
  const parsed = path.parse(filename);
  for (let index = 0; index < 1000; index += 1) {
    const suffix = index ? `-${index}` : "";
    const candidate = path.join(downloadDir, `${parsed.name}${suffix}${parsed.ext}`);
    try {
      await stat(candidate);
    } catch {
      return candidate;
    }
  }
  throw statusError("저장할 파일 이름을 만들지 못했습니다.", 500);
}

async function openLocalFile(filePath: string) {
  if (process.platform === "darwin") {
    await execFileAsync("open", [filePath]);
    return;
  }
  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", filePath]);
    return;
  }
  await execFileAsync("xdg-open", [filePath]);
}

function anthropicFileMetadata(file: AnthropicFileMetadata) {
  return {
    anthropic_file_id: file.id,
    anthropic_scope_id: file.scope?.id ?? null,
    anthropic_scope_type: file.scope?.type ?? null,
    anthropic_created_at: file.created_at ?? null,
  };
}

async function extractReadableText(file: FileRecord, bytes: ArrayBuffer) {
  const extension = file.originalName.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = file.mimeType.toLowerCase();
  if (mimeType === "application/pdf" || extension === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: Buffer.from(bytes) });
    try {
      const result = await parser.getText();
      return { text: normalizeExtractedText(result.text), extraction: "pdf" };
    } finally {
      await parser.destroy();
    }
  }

  if (isTextLikeFile(mimeType, extension)) {
    return {
      text: normalizeExtractedText(new TextDecoder("utf-8", { fatal: false }).decode(bytes)),
      extraction: "text",
    };
  }

  return {
    text: "",
    extraction: `unsupported:${mimeType || extension || "unknown"}`,
  };
}

function isTextLikeFile(mimeType: string, extension: string) {
  return (
    mimeType.startsWith("text/") ||
    ["application/json", "application/xml", "application/x-yaml"].includes(mimeType) ||
    ["csv", "json", "md", "txt", "tsv", "xml", "yaml", "yml", "html", "css", "js", "ts"].includes(extension)
  );
}

function normalizeExtractedText(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").trim();
}

function compactFile(file: FileRecord) {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
    versionNo: file.versionNo,
    accessLevel: file.accessLevel,
  };
}

async function cleanupUnreferencedFile(fileId: string, file: FileRecord) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return;
  }
  const [{ data: access }, { data: shared }, { data: imports }, { data: attachments }, { data: derivations }, { data: versions }] =
    await Promise.all([
      admin.from("file_room_access").select("room_id").eq("file_id", fileId),
      admin.from("shared_items").select("id").eq("source_file_id", fileId).limit(1),
      admin.from("meeting_imports").select("id").eq("source_file_id", fileId).limit(1),
      admin.from("message_attachments").select("message_id").eq("file_id", fileId).limit(1),
      admin.from("file_derivations").select("id").or(`source_file_id.eq.${fileId},derived_file_id.eq.${fileId}`).limit(1),
      admin.from("file_versions").select("storage_path").eq("file_id", fileId),
    ]);
  if (access?.length || shared?.length || imports?.length || attachments?.length || derivations?.length) {
    return;
  }

  const versionRows = (versions ?? []) as Array<{ storage_path?: string | null }>;
  const storagePaths = new Set([file.storagePath, ...versionRows.map((version) => version.storage_path).filter((path): path is string => Boolean(path))]);
  await admin.storage.from(WORKSPACE_FILES_BUCKET).remove([...storagePaths]);
  await admin.from("files").delete().eq("id", fileId);
}

function statusError(message: string, status: number) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function isMountedSourceFile(
  sessionFile: AnthropicFileMetadata,
  sourceFiles: Array<{
    anthropicFileId: string;
    originalName: string;
    sizeBytes: number;
    mimeType?: string | null;
    mountPath?: string | null;
  }>,
) {
  if (sourceFiles.some((file) => file.anthropicFileId === sessionFile.id)) {
    return true;
  }

  const sessionFileName = displayFileName(sessionFile.filename || "");
  return sourceFiles.some((file) => {
    const sessionSize = sessionFile.size_bytes ?? file.sizeBytes;
    const sameSize = Math.abs(sessionSize - file.sizeBytes) <= 1;
    const sameMimeType = !sessionFile.mime_type || !file.mimeType || sessionFile.mime_type === file.mimeType;
    const sourceNames = new Set([
      displayFileName(file.originalName),
      displayFileName(safeName(file.originalName)),
      file.mountPath ? displayFileName(file.mountPath) : "",
    ]);
    return sameSize && sameMimeType && (sourceNames.has(sessionFileName) || sourceFiles.length === 1);
  });
}

function guessMimeType(originalName: string) {
  const extension = originalName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "csv":
      return "text/csv;charset=utf-8";
    case "html":
      return "text/html;charset=utf-8";
    case "json":
      return "application/json";
    case "md":
      return "text/markdown;charset=utf-8";
    case "txt":
      return "text/plain;charset=utf-8";
    default:
      return "text/plain;charset=utf-8";
  }
}
