import { test, expect } from "@playwright/test";

const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/product", name: "product" },
  { path: "/integrations", name: "integrations" },
  { path: "/use-cases", name: "use-cases" },
  { path: "/use-cases/school-fees", name: "use-cases-slug" },
  { path: "/pricing", name: "pricing" },
  { path: "/trust", name: "trust" },
  { path: "/guides", name: "guides" },
  { path: "/guides/the-double-charge-bug", name: "guides-article" },
  { path: "/changelog", name: "changelog" },
  { path: "/hall", name: "hall" },
  { path: "/kitchen-sink", name: "kitchen-sink" },
];

for (const route of ROUTES) {
  test(`renders ${route.path}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));

    const response = await page.goto(route.path, { waitUntil: "networkidle" });
    expect(response?.ok(), `HTTP ok for ${route.path}`).toBeTruthy();

    // Chrome is present on every page.
    await expect(page.locator("header").first()).toBeVisible();
    await expect(page.locator("footer").first()).toBeVisible();

    await page.screenshot({
      path: `.design-refs/actual/${testInfo.project.name}/${route.name}.png`,
      fullPage: true,
    });

    expect(errors, `no page errors on ${route.path}`).toEqual([]);
  });
}
