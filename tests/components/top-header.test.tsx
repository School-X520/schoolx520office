import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TopHeader } from "@/components/layout/TopHeader";
import type { UserProfile } from "@/types/domain";

const baseUser: UserProfile = {
  userId: "00000000-0000-4000-8000-000000000001",
  email: "teacher@example.com",
  displayName: "Teacher",
  avatarUrl: null,
  isAdmin: false,
  createdAt: "2026-05-08T00:00:00Z",
  updatedAt: "2026-05-08T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TopHeader", () => {
  it("hides the settings menu for non-admin users", () => {
    render(<TopHeader user={baseUser} />);

    expect(screen.queryByLabelText("관리")).not.toBeInTheDocument();
    expect(screen.getByLabelText("내 프로필 설정")).toBeInTheDocument();
    expect(screen.getByText("Teacher")).toBeInTheDocument();
  });

  it("shows the settings menu for admin users", () => {
    render(<TopHeader user={{ ...baseUser, isAdmin: true }} />);

    expect(screen.getByLabelText("관리")).toBeInTheDocument();
    expect(screen.getByLabelText("내 프로필 설정")).toBeInTheDocument();
  });

  it("saves profile settings through the profile API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        profile: {
          ...baseUser,
          displayName: "Updated Teacher",
          avatarUrl: "https://example.com/avatar.png",
          bio: "운영 담당",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TopHeader user={baseUser} />);

    await userEvent.click(screen.getByLabelText("내 프로필 설정"));
    await userEvent.clear(screen.getByLabelText("이름"));
    await userEvent.type(screen.getByLabelText("이름"), "Updated Teacher");
    await userEvent.type(screen.getByLabelText("사진 URL"), "https://example.com/avatar.png");
    await userEvent.type(screen.getByLabelText("소개"), "운영 담당");
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profile",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            displayName: "Updated Teacher",
            avatarUrl: "https://example.com/avatar.png",
            bio: "운영 담당",
          }),
        }),
      );
    });
    expect(await screen.findByText("저장되었습니다.")).toBeInTheDocument();
  });
});
