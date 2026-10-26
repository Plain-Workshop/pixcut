// Moves the playhead into the first scene so the animated title is visible.
async (page) => {
  await page.goto('http://127.0.0.1:1420/');
  const card = page.locator('.project-card').first();
  await card.waitFor();
  await card.locator('.project-open').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Timeline playhead"]');
    if (!input) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '2');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'output/playwright/templates-scene.png' });
  return { time: await page.locator('input[aria-label="Timeline playhead"]').inputValue() };
}
