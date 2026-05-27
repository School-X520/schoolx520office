import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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

describe("TopHeader", () => {
  it("hides the settings menu for non-admin users", () => {
    render(<TopHeader user={baseUser} />);

    expect(screen.queryByLabelText("관리")).not.toBeInTheDocument();
    expect(screen.queryByText("Teacher")).not.toBeInTheDocument();
  });

  it("shows the settings menu for admin users", () => {
    render(<TopHeader user={{ ...baseUser, isAdmin: true }} />);

    expect(screen.getByLabelText("관리")).toBeInTheDocument();
    expect(screen.queryByText("Teacher")).not.toBeInTheDocument();
  });
});
