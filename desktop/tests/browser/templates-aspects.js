// Opens a few templates of different aspect ratios and captures the preview so
// the type/photo composition can be reviewed.
async (page) => {
  const names = ['Mountain air', 'Café diary', 'Weekend away'];
  const shots = [];
  await page.goto('http://127.0.0.1:1420/');
  for (const name of names) {
    const browse = page.getByRole('button', { name: /Browse the full gallery|Templates/ }).first();
    if (await browse.count()) await browse.click().catch(() => {});
    const grid = page.locator('.template-grid');
    await grid.waitFor();
    const card = grid.locator('.template-card', { hasText: name }).first();
    await card.click();
    await page.waitForTimeout(400);
    const confirm = page.locator('button', { hasText: /^Use template|^Start/ }).last();
    if (await confirm.count()) await confirm.click().catch(() => {});
    await page.waitForTimeout(1600);
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
    shots.push({ name, file, title: await page.locator('.preview-title, .header-project-name, h1').first().innerText().catch(() => '') });
    await page.getByRole('button', { name: /^Home$/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  return { shots };
}
