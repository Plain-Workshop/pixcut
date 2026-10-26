// Opens the template gallery, checks every bundled photo actually loads, starts
// a template, and confirms the scenes embed the photo instead of linking online.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');
  await page.evaluate(() => indexedDB.deleteDatabase('pixcut-local'));
  await page.reload();
  await page.waitForTimeout(500);
  // Start from an empty editor so the template opens straight away.
  await page.locator('.home-card, .quick-card, button').filter({ hasText: /^New Video$/ }).first().click().catch(() => {});
  await page.waitForTimeout(400);
  // Home → Templates card opens the gallery.
  await page.getByRole('button', { name: /^Templates Start with a ready-made design/ }).click();
  const grid = page.locator('.template-grid');
  await grid.waitFor();
  const cards = grid.locator('img');
  const imageState = await cards.evaluateAll(nodes => nodes.map(node => ({
    src: node.getAttribute('src'),
    loaded: node.complete && node.naturalWidth > 0,
    width: node.naturalWidth,
  })));
  const categories = await page.locator('.template-categories button').allInnerTexts();
  await page.screenshot({ path: 'output/playwright/templates-gallery.png' });
  const cardCount = await grid.locator('.template-card').count();
  const names = await grid.locator('.template-card strong').allInnerTexts();
  // Open the first story.
  await grid.locator('.template-card').first().click();
  await page.waitForTimeout(300);
  const confirm = page.locator('.template-confirm button.button.primary, button:has-text("Start")').first();
  if (await confirm.count()) await confirm.click();
  await page.waitForTimeout(2500);
  const project = await page.evaluate(async () => {
    const library = await import('/src/stores/library.ts');
    const projects = await library.listProjects();
    if (!projects.length) return null;
    const full = await library.getLibraryProject(projects[0].id);
    return full ? {
      name: full.name,
      scenes: full.tracks[0].clips.length,
      images: full.tracks[0].clips.map(clip => clip.image.slice(0, 24)),
      titles: full.tracks[0].clips.map(clip => clip.textLayers?.[0]?.title ?? ''),
    } : null;
  });
  await page.screenshot({ path: 'output/playwright/templates-open.png' });
  return { categories, cardCount, names: names.slice(0, 4), brokenImages: imageState.filter(item => !item.loaded).length, imageWidths: imageState.slice(0, 4).map(item => item.width), project, errors };
}
