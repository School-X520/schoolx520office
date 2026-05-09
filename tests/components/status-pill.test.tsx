import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusPill } from "@/components/layout/StatusPill";

describe("StatusPill", () => {
  it("renders content", () => {
    render(<StatusPill tone="sage">대기</StatusPill>);
    expect(screen.getByText("대기")).toBeInTheDocument();
  });
});
