// Run with playwright-cli run-code using an isolated local browser profile.
// Requires PixCut's browser preview on http://127.0.0.1:1420.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');

  const name = `Creator checks ${Date.now()}`;
  await page.evaluate(async projectName => {
    const model = await import('/src/stores/model.ts');
    const library = await import('/src/stores/library.ts');
    const colors = ['#1f7a6d', '#b5542a', '#4b3a8f'];
    const scenes = colors.map((color, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color; ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#ffffff'; ctx.font = '150px sans-serif'; ctx.fillText(String(index + 1), 120, 220);
      return {
        id: `scene-${index}`, name: `Scene ${index + 1}`, image: canvas.toDataURL(),
        startTicks: index * 15, sourceInTicks: 0, durationTicks: 15,
        title: `Title ${index + 1}`, subtitle: '', color: '#FFFFFF', fit: 'cover',
      };
    });
    let project = model.edit(model.emptyProject(projectName), { type: 'add', scenes });
    project = model.edit(project, { type: 'overlays', overlays: [{
      id: 'check-overlay', kind: 'label', label: 'Centre me', x: .5, y: .5, width: .3, height: .14,
      rotation: 0, opacity: 1, fontSize: 42, color: '#FFFFFF', background: '#111827',
      startTicks: 0, durationTicks: 45,
    }] });
    await library.saveLibraryProject(project);
  }, name);

  await page.reload();
  await page.getByRole('button', { name: new RegExp(`^16:9 ${name}`) }).click();
  await page.waitForTimeout(600);

  const canvasSize = () => page.locator('.preview-canvas').evaluate(c => [c.width, c.height]);
  const report = { paused: await canvasSize() };

  const loopButton = page.getByRole('button', { name: /Loop playback/ });
  const cameraButton = page.getByRole('button', { name: /Save still frame/ });
  report.transport = { loop: await loopButton.count(), stillFrame: await cameraButton.count() };

  // Playback scaling: 1920×1080 renders at 720 wide while playing, 1280 when paused.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(400);
  report.playing = await canvasSize();
  const pause = page.getByRole('button', { name: 'Pause', exact: true });
  if (await pause.count()) await pause.click();
  await page.waitForTimeout(500);
  report.pausedAgain = await canvasSize();

  // Loop playback: the story is 1.5 s, so it must survive several passes.
  await loopButton.click();
  report.loopLabel = await loopButton.getAttribute('aria-label');
  await page.getByRole('button', { name: 'Return to start' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.waitForTimeout(3200);
  report.afterLoop = {
    playing: Boolean(await page.getByRole('button', { name: 'Pause', exact: true }).count()),
    playhead: await page.locator('.scrubber').inputValue(),
    total: await page.locator('.timeline-total').innerText(),
  };
  await page.getByRole('button', { name: 'Pause', exact: true }).click().catch(() => {});
  await page.getByRole('button', { name: 'Loop playback on' }).click();

  // Alignment guides: text drags snap the box edges, overlay drags snap their centre.
  await page.locator('.scene-track .timeline-clip').first().click();
  await page.waitForTimeout(400);
  const textBox = page.locator('.text-box').first();
  const textRect = await textBox.boundingBox();
  const stageRect = await page.locator('.preview-stage').boundingBox();
  const geom = await textBox.evaluate(el => ({
    left: parseFloat(el.style.left), top: parseFloat(el.style.top),
    width: parseFloat(el.style.width), height: parseFloat(el.style.height),
  }));
  // Move the box onto its own centre snap targets, stopping 3 px short.
  const dx = ((100 - geom.width) / 2 - geom.left) / 100 * stageRect.width + 3;
  const dy = ((100 - geom.height) / 2 - geom.top) / 100 * stageRect.height + 3;
  const textCentre = { x: textRect.x + textRect.width / 2, y: textRect.y + textRect.height / 2 };
  await page.mouse.move(textCentre.x, textCentre.y);
  await page.mouse.down();
  await page.mouse.move(textCentre.x + dx, textCentre.y + dy, { steps: 4 });
  await page.waitForTimeout(120);
  report.textGuidesDuringDrag = await page.locator('.snap-guide').evaluateAll(list => list.map(node => node.className));
  await page.screenshot({ path: '../output/playwright/creator-text-guides.png' });
  await page.mouse.up();
  await page.waitForTimeout(300);
  report.textGuidesAfterDrop = await page.locator('.snap-guide').count();
  report.afterTextDrag = await page.evaluate(() => ({
    overlays: document.querySelectorAll('.overlay-hitbox').length,
    textBoxes: document.querySelectorAll('.text-box').length,
    error: document.querySelector('.error-banner')?.innerText ?? null,
    playhead: document.querySelector('.scrubber')?.value,
    playing: Boolean(document.querySelector('.play-button[aria-label="Pause"]')),
    toast: document.querySelector('.toast')?.innerText ?? null,
  }));

  const hitbox = page.locator('.overlay-hitbox').first();
  const box = await hitbox.boundingBox();
  const stage = await page.locator('.preview-stage').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 4, box.y + box.height / 2 + 3, { steps: 4 });
  await page.waitForTimeout(120);
  report.guides = {
    stage: stage && [Math.round(stage.width), Math.round(stage.height)],
    duringDrag: await page.locator('.snap-guide').evaluateAll(list => list.map(node => ({ cls: node.className, left: node.style.left, top: node.style.top }))),
  };
  await page.screenshot({ path: '../output/playwright/creator-snap-guides.png' });
  await page.mouse.up();
  await page.waitForTimeout(300);
  report.guides.afterDrop = await page.locator('.snap-guide').count();

  // Still frame: capture the data URL instead of letting the browser download it.
  await page.evaluate(() => {
    window.__still = null;
    const original = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { window.__still = { href: this.href, name: this.download }; return; }
      return original.call(this);
    };
  });
  await cameraButton.click();
  await page.waitForTimeout(1200);
  report.still = await page.evaluate(async () => {
    if (!window.__still) return null;
    const points = [[.5, .5], [.12, .12], [.88, .8], [.3, .68]];
    const read = canvas => {
      const ctx = canvas.getContext('2d');
      return points.map(([x, y]) => Array.from(ctx.getImageData(Math.floor(canvas.width * x), Math.floor(canvas.height * y), 1, 1).data).slice(0, 3));
    };
    const preview = document.querySelector('.preview-canvas');
    const image = new Image();
    image.src = window.__still.href;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    canvas.getContext('2d').drawImage(image, 0, 0);
    return {
      name: window.__still.name,
      size: [image.naturalWidth, image.naturalHeight],
      bytes: Math.round(window.__still.href.length * 0.75),
      playhead: document.querySelector('.scrubber').value,
      label: preview.getAttribute('aria-label'),
      preview: read(preview),
      still: read(canvas),
      previewSize: [preview.width, preview.height],
    };
  });
  report.toast = await page.locator('.toast').innerText().catch(() => null);
  report.errors = errors;
  console.log(JSON.stringify(report, null, 2));
}
