import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { memberships, rooms } from "@/lib/mock-data";

describe("SidebarPanel", () => {
  it("does not mark the meeting room active when no active room is provided", () => {
    render(<SidebarPanel rooms={rooms.filter((room) => room.isActive)} memberships={memberships} />);

    expect(screen.getByRole("link", { name: "🏛️메인 회의방" })).not.toHaveClass("bg-gold-soft");
  });

  it("marks only the provided active room as active", () => {
    render(<SidebarPanel rooms={rooms.filter((room) => room.isActive)} memberships={memberships} activeRoomId="finance" />);

    expect(screen.getByRole("link", { name: "💰재무" })).toHaveClass("bg-gold-soft");
    expect(screen.getByRole("link", { name: "🏛️메인 회의방" })).not.toHaveClass("bg-gold-soft");
  });
});
