import { expect, test } from "@playwright/test";

test("root redirects to office in mock mode", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/office$/);
  await expect(page.getByText("AI 협업 사무실 평면도")).toBeVisible();
});

test("mock login redirects to office", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/office$/);
  await expect(page.getByText("AI 협업 사무실 평면도")).toBeVisible();
});

test("office renders in mock mode", async ({ page }) => {
  await page.goto("/office");
  await expect(page.getByText("AI 협업 사무실 평면도")).toBeVisible();
});

test("meeting room renders in mock mode", async ({ page }) => {
  await page.goto("/rooms/meeting");
  await expect(page.getByRole("heading", { name: "메인 회의방", exact: true })).toBeVisible();
});
