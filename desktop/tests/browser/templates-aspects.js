// Opens a few templates of different aspect ratios and captures the preview so
// the type/photo composition can be reviewed.
async (page) => {
  const names = ['Mountain air', 'Café diary', 'Weekend away'];
  const shots = [];
  for (const name of names) {
    await page.goto('http://127.0.0.1:1420/');
    await page.waitForTimeout(900);
    await page.getByRole('button', { name: /^Templates Start with a ready-made design/ }).click();
    const grid = page.locator('.template-grid');
    await grid.waitFor();
    await grid.locator('.template-card', { hasText: name }).first().click();
    const confirm = page.locator('button', { hasText: `Start with ${name}` }).first();
    await confirm.waitFor();
    await confirm.click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => {
      const input = document.querySelector('input[aria-label="Timeline playhead"]');
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '1.8');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(900);
    const file = `output/playwright/template-${name.toLowerCase().replace(/[^a-z]+/g, '-')}.png`;
    await page.screenshot({ path: file });
    shots.push({ name, file });
  }
  return { shots };
}
