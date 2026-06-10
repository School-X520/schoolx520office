import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api";
import { statusError } from "@/lib/http-error";
import { shouldUseMockData } from "@/lib/env";
import { requireUser } from "@/server/auth/require-user";
import { mockStore } from "@/server/data/mock-store";
import { supabaseStore } from "@/server/data/supabase-store";

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1, "이름을 입력해 주세요.").max(40, "이름은 40자 이하로 입력해 주세요."),
  avatarUrl: z.string().max(1000, "사진 URL이 너무 깁니다.").nullish(),
  bio: z.string().max(240, "소개는 240자 이하로 입력해 주세요.").nullish(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = profileUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw statusError(parsed.error.issues[0]?.message ?? "프로필 입력값을 확인해 주세요.", 400);
    }

    const displayName = parsed.data.displayName;
    const avatarUrl = normalizeAvatarUrl(parsed.data.avatarUrl);
    const bio = normalizeOptionalText(parsed.data.bio);
    const source = shouldUseMockData() ? mockStore : supabaseStore;

    if (!shouldUseMockData()) {
      await supabaseStore.ensureUserProfile({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl ?? null,
        isAdmin: user.isAdmin,
      });
    }

    const profile = await source.updateUserProfile(user.userId, { displayName, avatarUrl, bio });
    if (!profile) {
      throw statusError("프로필을 찾지 못했습니다.", 404);
    }

    await source.addAuditLog({
      actorUserId: user.userId,
      action: "user_profile.updated",
      targetType: "user_profile",
      targetId: user.userId,
      metadata: {
        changed: {
          displayName: user.displayName !== profile.displayName,
          avatarUrl: (user.avatarUrl ?? null) !== (profile.avatarUrl ?? null),
          bio: (user.bio ?? null) !== (profile.bio ?? null),
        },
      },
    });

    return jsonOk({ profile });
  } catch (error) {
    return jsonError(error);
  }
}

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function normalizeAvatarUrl(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw statusError("사진 URL 형식이 올바르지 않습니다.", 400);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw statusError("사진 URL은 http 또는 https 주소여야 합니다.", 400);
  }

  return url.href;
}
