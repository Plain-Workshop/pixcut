// Confirms the photo-only export path (App.tsx exportVideo fallback) composites
// raised text above an overlay: drawScene must honour z, not paint every overlay
// on top afterwards. Run with playwright-cli run-code against :1420.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');
  const result = await page.evaluate(async () => {
    const render = await import('/src/components/preview/render.ts');
    const model = await import('/src/stores/model.ts');
    const { createTextLayer } = await import('/src/components/text/layers.ts');
    await document.fonts.ready;
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const overlay = { id: 'o', kind: 'rectangle', x: .5, y: .5, width: 1, height: 1, color: '#FF0000', rotation: 0, opacity: 100, startTicks: 0, durationTicks: 120, animation: 'none', z: 1_000 };
    const text = { ...createTextLayer(120, { startTicks: 0 }), id: 't', title: 'ABOVE', x: .1, y: .4, width: .8, size: .16, align: 'left', color: '#FFFFFF', animation: 'none', z: 2_000 };
    const scene = { id: 's', name: 'S', image: png, startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', textLayers: [text], color: '#FFFFFF', fit: 'cover' };
    const canvas = document.createElement('canvas');
    const count = () => {
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let white = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] > 230 && data[i + 1] > 230 && data[i + 2] > 230) white += 1;
      return white;
    };
    // Current export branch: one composite call with the overlays and their project time.
    await render.drawScene(canvas, scene, '16:9', 'export', 0, model.DEFAULT_TIMEBASE, { width: 640, height: 360 }, undefined, [], [overlay], 0);
    const stacked = count();
    // What the old code produced: scene text, then overlays painted over it.
    await render.drawScene(canvas, { ...scene, textLayers: [] }, '16:9', 'export', 0, model.DEFAULT_TIMEBASE, { width: 640, height: 360 }, undefined, [], [], 0);
    await render.drawProjectOverlays(canvas, [overlay], 0, model.DEFAULT_TIMEBASE, true, []);
    const covered = count();
    return { stacked, covered, pixels: canvas.width * canvas.height };
  });
  return { ...result, errors };
}
