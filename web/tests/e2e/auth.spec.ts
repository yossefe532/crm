import { test, expect } from "@playwright/test"

test("login success triggers network request and redirects", async ({ page }) => {
  let seen = false
  await page.route("**/api/auth/login", async (route) => {
    seen = true
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

  await expect.poll(() => seen).toBe(true)
  await expect(page).toHaveURL(/owner/)
})

test("login invalid credentials shows message", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "بيانات الدخول غير صحيحة" })
    })
  })

  await page.goto("/login")
  await page.getByLabel("البريد الإلكتروني").fill("owner@example.com")
  await page.getByLabel("كلمة المرور").fill("wrong")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()

  await expect(page.getByText("بيانات الدخول غير صحيحة")).toBeVisible()
})

test("login network failure shows connection error", async ({ page }) => {
  await page.route("**/api/auth/login", async (route) => {
    await route.abort()
  })

  await page.goto("/login")
  await page.getByLabel("البريد الإلكتروني").fill("owner@example.com")
  await page.getByLabel("كلمة المرور").fill("Str0ng!Pass")
  await page.getByRole("button", { name: "تسجيل الدخول" }).click()

  await expect(page.getByText("تعذر الاتصال بالخادم")).toBeVisible()
})

test("register conflict shows message", async ({ page }) => {
  await page.route("**/api/auth/register", async (route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "البريد الإلكتروني مستخدم بالفعل" })
    })
  })

  await page.goto("/register")
  await page.getByLabel("اسم الشركة").fill("Acme")
  await page.getByLabel("البريد الإلكتروني").fill("existing@example.com")
  await page.getByLabel("كلمة المرور").fill("Str0ng!Pass")
  await page.getByRole("button", { name: "إنشاء الحساب" }).click()

  await expect(page.getByText("البريد الإلكتروني مستخدم بالفعل")).toBeVisible()
})
