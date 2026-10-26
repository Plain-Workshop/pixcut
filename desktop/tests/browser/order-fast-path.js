// Checks the fast layer-order path end to end: the press uses the tiny `order`
// command, the canvas updates, and undo still steps back through it.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');
  const card = page.locator('.project-card').first();
  await card.waitFor();
  await card.locator('.project-open').click();
  const panel = page.getByRole('button', { name: /^Select overlay / }).first();
  await panel.waitFor();
  await panel.press('Enter');
  const down = page.getByRole('button', { name: 'Move layer down' });
  const up = page.getByRole('button', { name: 'Move layer up' });
  await down.waitFor();
  const step = async () => {
    if (await down.isEnabled()) await down.click();
    else await up.click();
    await page.waitForTimeout(600);
  };
  const readout = () => page.locator('.stack-order-head small').innerText();
  const before = await readout();
  const zBefore = await page.evaluate(async () => {
    const library = await import('/src/stores/library.ts');
    const projects = await library.listProjects();
    return projects[0]?.id;
  });
  await step();
  const afterOne = await readout();
  await step();
  const afterTwo = await readout();
  // Undo should step back through the order commands.
  await page.locator('button[aria-label^="Undo"]').click();
  await page.waitForTimeout(600);
  const afterUndo = await readout();
  await page.locator('button[aria-label^="Undo"]').click();
  await page.waitForTimeout(600);
  const afterSecondUndo = await readout();
  await page.screenshot({ path: 'output/playwright/order-fast-path.png' });
  const stored = await page.evaluate(async id => {
    const library = await import('/src/stores/library.ts');
    const project = await library.getLibraryProject(id);
    return project?.overlays?.map(overlay => overlay.z ?? null);
  }, zBefore);
  return { before, afterOne, afterTwo, afterUndo, afterSecondUndo, stored, errors };
}
