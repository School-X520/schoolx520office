import { jsonError, jsonOk } from "@/lib/api";
import { listRoomFiles, uploadRoomFile } from "@/server/files/file-service";
import { requireUser } from "@/server/auth/require-user";

function formText(value: FormDataEntryValue | null, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const roomId = new URL(request.url).searchParams.get("roomId") ?? "meeting";
    const files = await listRoomFiles(user.userId, roomId);
    return jsonOk({ files });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonOk({ ok: false, message: "file 필드가 필요합니다." }, { status: 400 });
    }

    const roomId = formText(formData.get("roomId"), "meeting");
    const uploaded = await uploadRoomFile({
      userId: user.userId,
      roomId,
      originalName: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
      content: file,
    });

    return jsonOk({ file: uploaded });
  } catch (error) {
    return jsonError(error);
  }
}
