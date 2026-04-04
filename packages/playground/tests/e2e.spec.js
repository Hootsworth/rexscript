import { test, expect } from '@playwright/test';

test.describe('RexScript Playground E2E', () => {
  test('should boot playground and interact with the engine', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/RexScript Playground/);
    
    // Check elements
    const runBtn = page.locator('#runBtn');
    await expect(runBtn).toBeVisible();
    
    const editor = page.locator('#editor');
    await expect(editor).toBeVisible();
    
    // Simulate web connection text
    await expect(page.locator('#terminal')).toContainText('[Connected to Runtime Engine]');
  });
});
