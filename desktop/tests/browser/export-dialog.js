// Run with playwright-cli run-code using an isolated local browser profile.
// Requires PixCut's browser preview on http://127.0.0.1:1420.
async (page) => {
  await page.goto('http://127.0.0.1:1420/');
  const fixtureName = `Export dialog regression ${Date.now()}`;
  await page.evaluate(async name => {
    const model = await import('/src/stores/model.ts');
    const library = await import('/src/stores/library.ts');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const context = canvas.getContext('2d'); context.fillStyle = '#254A48'; context.fillRect(0, 0, 320, 180);
    let project = model.edit(model.emptyProject(name), { type: 'add', scenes: [{ id: 'background', name: 'Background', image: canvas.toDataURL(), startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: 'Caption', subtitle: '', color: '#FFFFFF', fit: 'cover' }] });
    project = model.edit(project, { type: 'overlays', overlays: Array.from({ length: 64 }, (_, index) => ({ id: `layer-${index}`, kind: 'label', label: `Layer ${index + 1}`, x: .5, y: .5, width: .35, height: .12, rotation: 0, opacity: 100, color: '#E6F2D8', animation: 'none', startTicks: 0, durationTicks: 120 })) });
    await library.saveLibraryProject(project);
  }, fixtureName);
  await page.reload();
  await page.getByRole('button', { name: new RegExp(`^16:9 ${fixtureName}`) }).click();
  await page.locator('.element-row .element-clip').last().click();
  const selected = page.locator('.preview-stage .element-box');
  if (!await selected.isVisible()) throw Error('Fixture overlay is not selected');
  const before = await page.locator('.preview-canvas').evaluate(canvas => canvas.toDataURL());
  async function verifyCovered(selector) {
    if (!await page.locator(selector).isVisible()) throw Error(`Missing editing guide: ${selector}`);
    const bounds = await page.locator('.preview-stage').boundingBox();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await page.getByRole('dialog', { name: 'Export video', exact: true }).waitFor();
    if (await page.locator(selector).isVisible()) throw Error(`Editing guide remains visible: ${selector}`);
    const covered = await page.evaluate(bounds => {
      const stage = document.querySelector('.preview-stage');
      const points = [[.05,.05],[.5,.05],[.95,.05],[.05,.5],[.5,.5],[.95,.5],[.05,.95],[.95,.95]];
      return stage.inert && getComputedStyle(stage).isolation === 'isolate' && points.every(([x,y]) => document.elementFromPoint(bounds.x + bounds.width*x, bounds.y + bounds.height*y)?.closest('.modal-backdrop'));
    }, bounds);
    if (!covered) throw Error('Preview layers escape the modal backdrop');
    await page.getByRole('button', { name: /H.265 \/ HEVC/ }).click();
    await page.getByLabel('Video container', { exact: true }).selectOption('mov');
    await page.getByRole('button', { name: 'High Sharper details', exact: true }).click();
    await page.getByLabel('Video container', { exact: true }).selectOption('mkv');
    const summaries = new Set();
    for (let index = 0; index < 24; index++) {
      await page.keyboard.press('Tab');
      if (!await page.getByRole('dialog').evaluate(dialog => dialog.contains(document.activeElement))) throw Error('Keyboard focus escaped the dialog');
      const summary = await page.evaluate(() => document.activeElement.tagName === 'SUMMARY' ? document.activeElement.textContent : null);
      if (summary) summaries.add(summary);
    }
    if (summaries.size !== 2) throw Error('File naming disclosure controls are not keyboard accessible');
    await page.keyboard.press('Escape');
    if (!await page.locator(selector).isVisible()) throw Error('Closing export did not restore editing guides');
  }
  await verifyCovered('.preview-stage .element-box');
  const after = await page.locator('.preview-canvas').evaluate(canvas => canvas.toDataURL());
  if (before !== after) throw Error('Opening export changed the rendered project image');
  if (await selected.getAttribute('aria-pressed') !== 'true') throw Error('Export cleared the selected overlay');
  await page.locator('.scene-track .timeline-clip').first().click();
  await verifyCovered('.preview-stage .text-box');
  await page.getByRole('tab', { name: 'Framing', exact: true }).click();
  await page.getByRole('button', { name: 'Reposition', exact: true }).click();
  await verifyCovered('.preview-stage .image-framing-overlay');
  await page.getByRole('button', { name: 'Reposition', exact: true }).click();
  await page.locator('.element-row .element-clip').last().click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.screenshot({ path: 'output/playwright/export-layer-fixed.png' });
  return { overlayLayers: 64, coveredGuides: ['overlay', 'text', 'framing'], renderedImageUnchanged: true };
}
