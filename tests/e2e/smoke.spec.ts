import { expect, test } from "@playwright/test";

test("login renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "School-X 교사연구회 AI Office" })).toBeVisible();
});

test("office renders in mock mode", async ({ page }) => {
  await page.goto("/office");
  await expect(page.getByText("AI 협업 사무실 평면도")).toBeVisible();
});

test("meeting room renders in mock mode", async ({ page }) => {
  await page.goto("/rooms/meeting");
  await expect(page.getByRole("heading", { name: "메인 회의방" })).toBeVisible();
});
