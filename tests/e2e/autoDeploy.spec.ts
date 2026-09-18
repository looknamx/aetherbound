import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const output = "artifacts/cards";
async function joinPair(a: Page, b: Page) {
  await a.goto("/");
  await a.getByLabel("YOUR CALLSIGN").fill("Arden");
  await a.getByRole("button", { name: "Create a private room" }).click();
  const key = await a.getByTestId("room-key").innerText();
  await b.goto(`/?room=${key}`);
  await b.getByLabel("YOUR CALLSIGN").fill("Lyra");
  await b.getByRole("button", { name: "Join room" }).click();
  await a.getByRole("button", { name: "Ready up" }).click();
  await b.getByRole("button", { name: "Ready up" }).click();
  await a.getByRole("button", { name: "Begin expedition" }).click();
  await expect(
    a.getByRole("heading", { name: "Build your alliance" }),
  ).toBeVisible();
}
async function dev(page: Page, command: string, value?: string) {
  const panel = page.locator(".developer");
  if ((await panel.getAttribute("open")) === null)
    await panel.locator("summary").first().click();
  if (value) await page.getByLabel("Developer value").fill(value);
  await panel.getByRole("button", { name: command, exact: true }).click();
}
async function buy(page: Page, id: string) {
  await dev(page, "shop", id);
  await page.getByTestId("shop-0").click();
}
const boardBounds = async (page: Page) =>
  page.locator(".tile .card-face").evaluateAll((cards) =>
    cards.every((card) => {
      const r = card.getBoundingClientRect(),
        tile = card.closest(".tile")!.getBoundingClientRect();
      return (
        r.left >= tile.left - 1 &&
        r.right <= tile.right + 1 &&
        r.top >= tile.top - 1 &&
        r.bottom <= tile.bottom + 1
      );
    }),
  );
test("auto-deploy fills 2/4, broadcasts the same battle, survives reconnect, and repeats through two rounds", async ({
  browser,
}) => {
  await mkdir(output, { recursive: true });
  const ca = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
    }),
    cb = await browser.newContext({ viewport: { width: 1440, height: 1080 } }),
    a = await ca.newPage(),
    b = await cb.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
  }
  try {
    await joinPair(a, b);
    await dev(a, "gold");
    await dev(a, "level");
    await dev(a, "level");
    await buy(a, "cinder");
    await a.getByTestId("bench-0").click();
    await a.getByRole("gridcell", { name: "Tile 19", exact: true }).click();
    await buy(a, "brook");
    await a.getByTestId("bench-0").click();
    await a.getByRole("gridcell", { name: "Tile 31", exact: true }).click();
    await buy(a, "solara");
    await buy(a, "rivet");
    await buy(a, "lumen");
    await a.getByRole("button", { name: "Equip Sunshard" }).click();
    await a.getByTestId("bench-0").click();
    await expect(a.getByText("2 / 4 DEPLOYED")).toBeVisible();
    await expect(a.locator(".bench .is-recommended")).toHaveCount(2);
    await expect(
      a.getByTestId("bench-0").locator(".card-items .has-item"),
    ).toHaveCount(1);
    for (const card of [
      a.getByTestId("shop-1"),
      a.getByTestId("bench-0"),
      a.getByRole("gridcell", { name: "Tile 19: Cinder Sentry" }),
    ]) {
      await expect(card.locator("[data-corner]")).toHaveCount(4);
    }
    await a
      .getByRole("button", { name: "Inspect Lumen Scout", exact: true })
      .first()
      .click();
    await expect(a.getByRole("dialog", { name: "Card details" })).toContainText(
      "Magic resistance",
    );
    await a.getByRole("button", { name: "Close card details" }).click();
    await b.getByTestId("shop-0").click();
    await expect(b.getByText("0 / 2 DEPLOYED")).toBeVisible();
    await a.screenshot({
      path: `${output}/01-shop-bench-board.png`,
      fullPage: true,
    });
    await a.locator(".shop").screenshot({ path: `${output}/02-shop.png` });
    await a.locator(".bench").screenshot({ path: `${output}/03-bench.png` });
    expect(await boardBounds(a)).toBe(true);
    // Natural expiration, no deploy or advance command from either client.
    await expect(
      a.getByRole("heading", { name: "Let the banners clash" }),
    ).toBeVisible({ timeout: 35000 });
    await expect(a.getByText("4 / 4 DEPLOYED")).toBeVisible();
    await expect(a.locator(".deploy-notice")).toContainText("2 ใบ");
    await expect(a.locator(".deploy-notice")).toContainText("Solara");
    await expect(b.getByText("1 / 2 DEPLOYED")).toBeVisible();
    await expect(a.locator(".combat-card")).toHaveCount(5);
    await expect(b.locator(".combat-card")).toHaveCount(5);
    const defs = (page: Page) =>
      page
        .locator(".combat-card .unit-card")
        .evaluateAll((cards) =>
          cards
            .map(
              (c) =>
                `${c.getAttribute("data-def")}:${c.getAttribute("data-star")}`,
            )
            .sort(),
        );
    expect(await defs(a)).toEqual(await defs(b));
    await a
      .locator(".arena")
      .screenshot({ path: `${output}/04-battle-board.png` });
    await b.reload();
    await expect(
      b.getByRole("heading", { name: "Let the banners clash" }),
    ).toBeVisible();
    await expect(b.locator(".auto-flight")).toHaveCount(0);
    await expect(b.getByText("1 / 2 DEPLOYED")).toBeVisible();
    expect(await defs(a)).toEqual(await defs(b));
    await expect(
      a.getByRole("heading", { name: "The dust settles" }),
    ).toBeVisible({ timeout: 45000 });
    await expect(
      a.getByRole("heading", { name: "Build your alliance" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(a.getByText("4 / 4 DEPLOYED")).toBeVisible();
    await a
      .locator(".arena")
      .screenshot({ path: `${output}/05-deployed-board.png` });
    expect(await boardBounds(a)).toBe(true);
    await dev(a, "advance");
    await expect(
      a.getByRole("heading", { name: "Let the banners clash" }),
    ).toBeVisible();
    await a
      .getByRole("button", { name: /Inspect enemy/ })
      .first()
      .click();
    await expect(
      a.getByRole("dialog", { name: "Battle card details" }),
    ).toContainText("Magic resistance");
    await a.getByRole("button", { name: "Close card details" }).click();
    await expect(
      a.getByRole("heading", { name: "The dust settles" }),
    ).toBeVisible({ timeout: 45000 });
    await expect(
      b.getByRole("heading", { name: "The dust settles" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await ca.close();
    await cb.close();
  }
});
test("mobile cards fit the 6x6 tiles and touch selection opens full stats", async ({
  browser,
}) => {
  await mkdir(output, { recursive: true });
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    other = await browser.newContext(),
    a = await mobile.newPage(),
    b = await other.newPage();
  try {
    await joinPair(a, b);
    await a.getByTestId("shop-0").tap();
    await a.getByTestId("bench-0").tap();
    await a.getByRole("gridcell", { name: "Tile 19", exact: true }).tap();
    await expect(a.getByText("1 / 2 DEPLOYED")).toBeVisible();
    await expect(a.locator(".tile .unit-card")).toHaveCount(1);
    expect(await boardBounds(a)).toBe(true);
    expect(
      await a.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await a
      .locator(".tile")
      .filter({ has: a.locator(".unit-card") })
      .tap();
    await expect(a.locator(".unit-info .unit-card--detail")).toContainText(
      "Magic resistance",
    );
    await a.screenshot({
      path: `${output}/06-mobile-cards.png`,
      fullPage: true,
    });
  } finally {
    await mobile.close();
    await other.close();
  }
});
