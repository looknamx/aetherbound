import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const artifacts = "artifacts/playtest";
test("two browser clients: lobby, economy, drag, merge, relics, reconnect, automatic combat and final ranking", async ({
  browser,
}) => {
  await mkdir(artifacts, { recursive: true });
  const ca = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
    }),
    cb = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const a = await ca.newPage(),
    b = await cb.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
  }
  try {
    await a.goto("/");
    await expect(a.getByText("● Connected", { exact: true })).toBeVisible();
    await a.screenshot({ path: `${artifacts}/01-landing.png`, fullPage: true });
    await a.getByLabel("YOUR CALLSIGN").fill("Arden");
    await a.getByRole("button", { name: "Create a private room" }).click();
    const key = await a.getByTestId("room-key").innerText();
    await b.goto("/");
    await b.getByLabel("YOUR CALLSIGN").fill("Lyra");
    await b.getByLabel("Room key").fill(key);
    await b.getByRole("button", { name: "Join room" }).click();
    await expect(
      b.getByRole("heading", { name: "Arden", exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "Ready up" }).click();
    await b.getByRole("button", { name: "Ready up" }).click();
    await expect(
      a.getByRole("button", { name: "Begin expedition" }),
    ).toBeEnabled();
    await a.screenshot({ path: `${artifacts}/02-lobby.png`, fullPage: true });
    await a.getByRole("button", { name: "Begin expedition" }).click();
    await expect(
      a.getByRole("heading", { name: "Build your alliance" }),
    ).toBeVisible();
    await expect(
      b.getByRole("heading", { name: "Build your alliance" }),
    ).toBeVisible();
    const dev = async (command: string, value?: string) => {
      const host = (await a.locator("details.developer").count()) ? a : b;
      const details = host.locator("details.developer");
      if ((await details.getAttribute("open")) === null)
        await details.locator("summary").first().click();
      if (value !== undefined)
        await host.getByLabel("Developer value").fill(value);
      await details.getByRole("button", { name: command, exact: true }).click();
    };
    await dev("shop", "cinder");
    await a.getByTestId("shop-0").click();
    await a.getByTestId("shop-1").click();
    await a.getByTestId("shop-2").click();
    await expect(a.getByTestId("bench-0")).toContainText("★★");
    await a
      .getByTestId("bench-0")
      .dragTo(a.getByRole("gridcell", { name: "Tile 19", exact: true }));
    await expect(
      a.getByRole("gridcell", { name: "Tile 19: Cinder Sentry", exact: true }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: "Equip Sunshard", exact: true })
      .click();
    await a
      .getByRole("gridcell", { name: "Tile 19: Cinder Sentry", exact: true })
      .click();
    await a
      .getByRole("gridcell", { name: "Tile 19: Cinder Sentry", exact: true })
      .click();
    await expect(a.locator(".equipped button")).toHaveCount(1);
    await a.getByRole("button", { name: "Clear selection" }).click();
    await a.getByTestId("shop-3").click();
    await a.getByTestId("bench-0").click();
    await a.getByRole("button", { name: "Sell recruit" }).click();
    await expect(a.getByTestId("gold")).toHaveText("7");
    await a.getByRole("button", { name: "Refresh" }).click();
    await expect(a.getByTestId("gold")).toHaveText("5");
    await a.getByRole("button", { name: "Lock shop" }).click();
    await expect(a.getByRole("button", { name: "Locked" })).toBeVisible();
    await a.getByRole("button", { name: "Buy 4 XP" }).click();
    await expect(a.getByTestId("gold")).toHaveText("1");
    await b.getByTestId("shop-0").click();
    await b.getByTestId("bench-0").click();
    await b.getByRole("gridcell", { name: "Tile 19", exact: true }).click();
    await expect(b.getByText("1 / 2 DEPLOYED")).toBeVisible();
    await a.reload();
    await expect(
      a.getByRole("gridcell", { name: "Tile 19: Cinder Sentry", exact: true }),
    ).toBeVisible();
    await expect(a.getByTestId("gold")).toHaveText("1");
    await a.screenshot({
      path: `${artifacts}/03-preparation.png`,
      fullPage: true,
    });
    // Let the unmodified 30-second preparation timer start battle automatically.
    await expect(
      a.getByRole("heading", { name: "Let the banners clash" }),
    ).toBeVisible({ timeout: 40000 });
    await expect(
      b.getByRole("heading", { name: "Let the banners clash" }),
    ).toBeVisible();
    expect(await a.locator(".board-top").innerText()).toContain(" vs ");
    expect(await b.locator(".board-top").innerText()).toContain(" vs ");
    await expect(a.getByRole("button", { name: "Refresh" })).toBeDisabled();
    await a.screenshot({ path: `${artifacts}/04-combat.png`, fullPage: true });
    await expect(
      a.getByRole("heading", { name: "The dust settles" }),
    ).toBeVisible({ timeout: 45000 });
    await expect(
      b.getByRole("heading", { name: "The dust settles" }),
    ).toBeVisible();
    expect(await a.locator(".player-list").innerText()).toContain("Arden");
    await dev("speed", "20");
    await dev("advance");
    await expect(a.getByText("THE LAST BANNER STANDING")).toBeVisible({
      timeout: 90000,
    });
    await expect(b.getByText("THE LAST BANNER STANDING")).toBeVisible();
    expect(await a.locator(".finish h1").innerText()).toBe(
      await b.locator(".finish h1").innerText(),
    );
    expect(await a.locator(".ranking").allTextContents()).toEqual(
      await b.locator(".ranking").allTextContents(),
    );
    await a.screenshot({ path: `${artifacts}/05-finish.png`, fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
  }
});
test("touch-size layout and field guide remain usable", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.getByLabel("YOUR CALLSIGN")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `${artifacts}/06-mobile.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByLabel("Reduce motion & effects").check();
    await page.getByRole("button", { name: "Close", exact: true }).click();
  } finally {
    await context.close();
  }
});
