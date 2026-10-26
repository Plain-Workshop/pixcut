// Measures what a single "Layer order" press costs: frame gaps + CPU profile.
async (page) => {
  await page.goto('http://127.0.0.1:1420/');
  // Reload lands on Home; reopen the most recent project (the one with layers).
  const card = page.locator('.project-card').first();
  await card.waitFor();
  await card.locator('.project-open').click();
  // Synthetic clicks are ignored on purpose (detail === 0), so select by keyboard.
  const panel = page.getByRole('button', { name: /^Select overlay / }).first();
  await panel.waitFor();
  await panel.press('Enter');
  const down = page.getByRole('button', { name: 'Move layer down' });
  await down.waitFor();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  const timing = await page.evaluate(() => {
    window.__gaps = [];
    let last = performance.now();
    const loop = now => { window.__gaps.push(now - last); last = now; if (window.__gaps.length < 400) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    window.__long = [];
    window.__obs = new PerformanceObserver(list => { for (const e of list.getEntries()) window.__long.push(Math.round(e.duration)); });
    window.__obs.observe({ entryTypes: ['longtask'] });
    return true;
  });
  await cdp.send('Profiler.start');
  const started = Date.now();
  await down.click();
  await page.waitForTimeout(2500);
  const { profile } = await cdp.send('Profiler.stop');
  const elapsed = Date.now() - started;
  const observed = await page.evaluate(() => ({ gaps: window.__gaps.map(v => Math.round(v)), long: window.__long }));
  // Aggregate self time per function.
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const self = new Map();
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    const dt = profile.timeDeltas[i] ?? 0;
    total += dt;
    if (!node) continue;
    const cf = node.callFrame;
    const key = `${cf.functionName || '(anonymous)'} @ ${(cf.url || '').split('/').slice(-2).join('/')}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + dt);
  }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => `${(v / 1000).toFixed(0)}ms ${k}`);
  return {
    elapsed,
    maxFrameGap: Math.max(...observed.gaps),
    gapsOver200: observed.gaps.filter(g => g > 200),
    longTasks: observed.long,
    profiledMs: Math.round(total / 1000),
    top,
  };
}
