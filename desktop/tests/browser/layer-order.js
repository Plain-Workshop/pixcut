// Run with playwright-cli run-code against the local Vite preview on :1420.
// Checks that layer order really changes what the canvas draws and that the
// project keeps the chosen order after saving.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');

  const name = `Layer order ${Date.now()}`;
  // The video-export renderer must use the same order as the preview.
  const overlayExport = await page.evaluate(async () => {
    const model = await import('/src/stores/model.ts');
    const render = await import('/src/components/preview/render.ts');
    const { createTextLayer } = await import('/src/components/text/layers.ts');
    const text = { ...createTextLayer(30, { startTicks: 0 }), id: 't', title: 'ABOVE', x: .1, y: .4, width: .8, size: .16, align: 'left', color: '#FFFFFF', animation: 'none' };
    const panel = { id: 'p', kind: 'rectangle', x: .5, y: .5, width: .9, height: .5, rotation: 0, opacity: 100, color: '#FF0000', startTicks: 0, durationTicks: 30, animation: 'none' };
    const scene = { id: 's', name: 'S', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks: 30, title: text.title, subtitle: '', textLayers: [text], color: '#FFFFFF', fit: 'cover' };
    const draw = async layers => {
      const canvas = document.createElement('canvas');
      await render.drawOverlayStack(canvas, scene, layers, { width: 640, height: 360 }, 0, 0, model.DEFAULT_TIMEBASE, false, []);
      const ctx = canvas.getContext('2d');
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let white = 0, red = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) white += 1;
        if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) red += 1;
      }
      return { white, red };
    };
    const below = await draw([{ ...panel, z: 1 }]);
    const above = await draw([panel]);
    return { textAbove: below, textBelow: above };
  });
  await page.evaluate(async projectName => {
    const model = await import('/src/stores/model.ts');
    const library = await import('/src/stores/library.ts');
    const { createTextLayer } = await import('/src/components/text/layers.ts');
    const bg = document.createElement('canvas');
    bg.width = 1920; bg.height = 1080;
    const bc = bg.getContext('2d');
    bc.fillStyle = '#101018'; bc.fillRect(0, 0, 1920, 1080);
    const text = { ...createTextLayer(150, { startTicks: 0 }), id: 'title', title: 'ABOVE', subtitle: '', x: .1, y: .4, width: .8, size: .16, align: 'left', color: '#FFFFFF', animation: 'none', backdropEnabled: false };
    const scene = { id: 'scene', name: 'Scene 1', image: bg.toDataURL(), startTicks: 0, sourceInTicks: 0, durationTicks: 150, title: text.title, subtitle: '', textLayers: [text], color: '#FFFFFF', fit: 'cover' };
    let project = model.edit(model.emptyProject(projectName), { type: 'add', scenes: [scene] });
    project = model.edit(project, { type: 'overlays', overlays: [{
      id: 'panel', kind: 'rectangle', label: undefined, x: .5, y: .5, width: .9, height: .5,
      rotation: 0, opacity: 100, color: '#FF0000', startTicks: 0, durationTicks: 150, animation: 'none',
    }] });
    await library.saveLibraryProject(project);
  }, name);

  await page.reload();
  await page.getByRole('button', { name: new RegExp(`^16:9 ${name}`) }).click();
  await page.waitForTimeout(700);

  const sample = () => page.locator('.preview-canvas').evaluate(canvas => {
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let white = 0, red = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) white += 1;
      if (data[i] > 200 && data[i + 1] < 60 && data[i + 2] < 60) red += 1;
    }
    return { white, red };
  });

  const before = await sample();
  await page.getByRole('tab', { name: 'Text' }).click();
  await page.waitForTimeout(200);
  const orderPanel = page.locator('.stack-order').last();
  const readout = await orderPanel.locator('small').innerText();
  await orderPanel.getByRole('button', { name: 'Bring to front' }).click();
  await page.waitForTimeout(700);
  const afterFront = await sample();
  await page.getByRole('button', { name: 'Save project', exact: true }).click().catch(() => {});
  await page.waitForTimeout(400);
  const saved = await page.evaluate(async () => {
    const model = await import('/src/stores/model.ts');
    const library = await import('/src/stores/library.ts');
    const list = await library.listProjects();
    const entry = list[0];
    const project = await library.getLibraryProject(entry.id);
    return { textZ: project.tracks[0].clips[0].textLayers[0].z, overlayZ: project.overlays[0].z };
  });
  await page.screenshot({ path: 'output/playwright/layer-order.png', fullPage: false });
  await orderPanel.screenshot({ path: 'output/playwright/layer-order-panel.png' });

  // The same control is available for a selected overlay in the inspector.
  await page.locator('.overlay-hitbox').first().click();
  await page.waitForTimeout(500);
  const elementOrder = await page.locator('.stack-order').first().innerText().catch(() => 'missing');
  await page.locator('.stack-order').first().getByRole('button', { name: 'Move layer up' }).click();
  await page.waitForTimeout(700);
  const afterOverlayForward = await sample();
  await page.waitForTimeout(1200);
  const savedOverlay = await page.evaluate(async () => {
    const library = await import('/src/stores/library.ts');
    const list = await library.listProjects();
    const project = await library.getLibraryProject(list[0].id);
    return { overlayZ: project.overlays[0].z, textZ: project.tracks[0].clips[0].textLayers[0].z };
  });
  await page.screenshot({ path: 'output/playwright/layer-order-element.png' });

  return { before, afterFront, afterOverlayForward, readout, elementOrder, saved, savedOverlay, overlayExport, errors };
}
