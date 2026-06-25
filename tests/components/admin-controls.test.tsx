import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AllowedUserForm } from "@/components/admin/AllowedUserForm";
import { AllowedUsersManager } from "@/components/admin/AllowedUsersManager";
import { MembershipManager } from "@/components/admin/MembershipManager";
import type { AllowedUser, PendingRoomMembership, Room, RoomMembership, UserProfile } from "@/types/domain";

const rooms: Room[] = [
  {
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
  },
  {
    id: "finance",
    name: "재무",
    type: "department",
    icon: "💰",
    description: "finance",
    displayOrder: 1,
    layoutX: 1,
    layoutY: 1,
    isActive: true,
    createdAt: "2026-05-08T00:00:00Z",
  },
  {
    id: "research",
    name: "연구",
    type: "department",
    icon: "🔬",
    description: "research",
    displayOrder: 2,
    layoutX: 2,
    layoutY: 1,
    isActive: true,
    createdAt: "2026-05-08T00:00:00Z",
  },
];

const profiles: UserProfile[] = [
  {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "teacher@example.com",
    displayName: "Teacher",
    avatarUrl: null,
    isAdmin: false,
    createdAt: "2026-05-08T00:00:00Z",
    updatedAt: "2026-05-08T00:00:00Z",
  },
];

const allowedUsers: AllowedUser[] = [
  {
    email: "teacher@example.com",
    invitedBy: null,
    invitedAt: "2026-05-08T00:00:00Z",
    notes: null,
    isActive: true,
    isAdmin: false,
  },
];

const pendingMemberships: PendingRoomMembership[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin controls", () => {
  it("submits a new approved user invite with notes and admin flag", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    render(<AllowedUserForm />);

    await userEvent.type(screen.getByLabelText("승인 사용자 이메일"), "new.teacher@example.com");
    await userEvent.type(screen.getByLabelText("승인 사용자 메모"), "과학관 담당");
    await userEvent.click(screen.getByRole("checkbox", { name: "관리자 권한" }));
    await userEvent.click(screen.getByRole("button", { name: "승인 사용자 추가" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/allowed-users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "new.teacher@example.com",
            notes: "과학관 담당",
            isAdmin: true,
            isActive: true,
          }),
        }),
      );
    });
    expect(await screen.findByText("승인 사용자에 추가했습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("승인 사용자 이메일")).toHaveValue("");
    expect(screen.getByLabelText("승인 사용자 메모")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "관리자 권한" })).not.toBeChecked();
  });

  it("updates allowed user active/admin state from the table", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const allowedUsersForTest: AllowedUser[] = [
      {
        email: "teacher@example.com",
        invitedBy: null,
        invitedAt: "2026-05-08T00:00:00Z",
        notes: null,
        isActive: true,
        isAdmin: false,
      },
    ];

    render(<AllowedUsersManager allowedUsers={allowedUsersForTest} currentUserEmail="admin@example.com" />);

    await userEvent.click(screen.getByRole("switch", { name: "teacher@example.com admin" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/allowed-users",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ email: "teacher@example.com", isAdmin: true }),
        }),
      );
    });
  });

  it("submits multiple selected rooms for one membership update", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const memberships: RoomMembership[] = [
      {
        userId: profiles[0].userId,
        roomId: "meeting",
        role: "member",
        joinedAt: "2026-05-08T00:00:00Z",
      },
    ];

    render(
      <MembershipManager
        allowedUsers={allowedUsers}
        rooms={rooms}
        memberships={memberships}
        pendingMemberships={pendingMemberships}
        profiles={profiles}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    await userEvent.click(screen.getByLabelText("재무 선택"));
    await userEvent.click(screen.getByLabelText("연구 선택"));
    await userEvent.click(screen.getByRole("button", { name: "권한 저장" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/memberships",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "membership.updated",
            targetUserId: profiles[0].userId,
            roomIds: ["finance", "research"],
            role: "member",
          }),
        }),
      );
    });
  });

  it("shows approved users without profiles as pending membership targets", async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const invitedOnlyUsers: AllowedUser[] = [
      ...allowedUsers,
      {
        email: "new.teacher@example.com",
        invitedBy: null,
        invitedAt: "2026-05-08T00:00:00Z",
        notes: null,
        isActive: true,
        isAdmin: false,
      },
    ];

    render(
      <MembershipManager
        allowedUsers={invitedOnlyUsers}
        rooms={rooms}
        memberships={[]}
        pendingMemberships={[]}
        profiles={profiles}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("사용자 선택"), "email:new.teacher@example.com");
    await userEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    await userEvent.click(screen.getByLabelText("재무 선택"));
    await userEvent.click(screen.getByRole("button", { name: "권한 저장" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/memberships",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            action: "membership.updated",
            targetUserId: "email:new.teacher@example.com",
            roomIds: ["finance"],
            role: "member",
          }),
        }),
      );
    });
  });
});
