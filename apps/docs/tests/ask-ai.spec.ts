import { expect, test } from "@playwright/test";

/**
 * End-to-end for the Ask-AI assistant: input clears on send, the transcript
 * keeps every turn, a follow-up continues the same conversation, and the thread
 * survives a reload (localStorage persistence). Hits the real Groq-backed
 * /api/ask, so answers stream for real.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("nbo-ask-history"));
  await page.reload();
});

test("multi-turn chat: input clears, history is kept, thread persists", async ({ page }) => {
  // Open the assistant.
  await page.getByRole("button", { name: "Ask AI about the docs" }).click();
  const input = page.getByPlaceholder("Ask a question…");
  await expect(input).toBeVisible();

  // Turn 1.
  await input.fill("How do I create a plan and a price?");
  await input.press("Enter");

  // Bug that was reported: input must clear on send.
  await expect(input).toHaveValue("");

  // The user's message is shown in the transcript.
  await expect(page.getByText("How do I create a plan and a price?")).toBeVisible();

  // The assistant streams a grounded answer that cites sources.
  const firstAnswer = page.getByText(/Sources:/i).first();
  await expect(firstAnswer).toBeVisible({ timeout: 40_000 });

  // Turn 2 — a follow-up that only makes sense with history.
  await input.fill("And how do I deactivate that price?");
  await input.press("Enter");
  await expect(input).toHaveValue("");

  // Turn 1 is still on screen (history kept), and turn 2 is added.
  await expect(page.getByText("How do I create a plan and a price?")).toBeVisible();
  await expect(page.getByText("And how do I deactivate that price?")).toBeVisible();

  // A second assistant answer arrives.
  await expect(page.getByText(/Sources:/i)).toHaveCount(2, { timeout: 40_000 });

  // Persistence: reload, reopen, the whole thread is restored.
  await page.reload();
  await page.getByRole("button", { name: "Ask AI about the docs" }).click();
  await expect(page.getByText("How do I create a plan and a price?")).toBeVisible();
  await expect(page.getByText("And how do I deactivate that price?")).toBeVisible();

  // New chat clears it.
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(page.getByText("How do I create a plan and a price?")).toHaveCount(0);
});
