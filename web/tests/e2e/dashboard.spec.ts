import { test, expect } from "@playwright/test"

test("redirects to login", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/login/)
})

test("owner dashboard visual", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "test-token",
        user: { id: "user-1", tenantId: "tenant-1", roles: ["owner"] }
      })
    })
  })
  await page.goto("/login")
  await page.getByLabel("البريد الإلكتروني").fill("owner@example.com")
  await page.getByLabel("كلمة المرور").fill("Str0ng!Pass")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()
  await expect(page).toHaveURL(/owner/)
})
