// Drives the Video audio lane end to end: linked clips, the per-clip level, the
// bus level and mute, and the values surviving a reload. The video itself is
// recorded in the page with MediaRecorder, so the check needs no fixture.
// Run with playwright-cli run-code against :1420.
async (page) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:1420/');
  await page.waitForSelector('input[accept=".json,.pixcut"]', { state: 'attached' });

  // A tiny VP8+Opus recording gives a real clip with frames and sound.
  const video = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(15);
    // Add a quiet tone so the recording carries an audio track the timeline can
    // analyse. Without it the lane would have nothing to draw.
    const audio = new AudioContext();
    const destination = audio.createMediaStreamDestination();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    gain.gain.value = 0.35;
    oscillator.connect(gain).connect(destination);
    oscillator.start();
    destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
    await audio.resume();
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    const started = performance.now();
    while (performance.now() - started < 1200) {
      ctx.fillStyle = `hsl(${(performance.now() / 5) % 360} 90% 50%)`;
      ctx.fillRect(0, 0, 320, 180);
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    recorder.stop();
    await stopped;
    oscillator.stop();
    await audio.close();
    const bytes = new Uint8Array(await new Blob(chunks, { type: mime }).arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return { mime, base64: btoa(binary) };
  }, []);

  const json = await page.evaluate(async video => {
    const model = await import('/src/stores/model.ts');
    // The project validator accepts `data:video/webm;...`, not the recorder's
    // `video/webm;codecs=vp8`, and the browser sniffs the codec from the bytes.
    const source = `data:${video.mime.split(';')[0]};base64,${video.base64}`;
    const poster = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const clip = (id, startTicks, videoVolume, sourceInTicks) => ({
      id, name: id, startTicks, sourceInTicks, durationTicks: 15, title: '', subtitle: '',
      image: source, videoPoster: poster, mediaKind: 'video', sourceDurationSeconds: 1.2,
      color: '#ffffff', fit: 'cover', speed: 1, pitch: true, filter: 'none', filterIntensity: 100, videoVolume,
    });
    let project = model.emptyProject('Mixer browser check', '16:9', 30);
    project = model.edit(project, { type: 'add', scenes: [clip('First clip', 0, 100, 0), clip('Second clip', 15, 70, 15)] });
    project = model.edit(project, { type: 'audioMix', mix: { video: 0.7, lanes: [] } });
    return JSON.stringify(project);
  }, video);

  await page.setInputFiles('input[accept=".json,.pixcut"]', { name: 'mixer.json', mimeType: 'application/json', buffer: Buffer.from(json, 'utf8') });
  await page.waitForSelector('.video-audio-row', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 15000 });

  const state = () => page.evaluate(() => ({
    bus: document.querySelector('.video-audio-row .track-volume-value')?.textContent,
    busSlider: document.querySelector('.video-audio-row input[aria-label="Video audio volume"]')?.value,
    mute: document.querySelector('.video-audio-row .track-mute')?.getAttribute('aria-label'),
    clips: Array.from(document.querySelectorAll('.video-audio-clip')).map(node => ({
      name: node.querySelector('.audio-name')?.textContent,
      level: node.querySelector('small')?.textContent,
      selected: node.classList.contains('selected'),
      slider: node.querySelector('input[type="range"]')?.value ?? null,
    })),
    fakeWave: document.querySelectorAll('.video-audio-wave').length,
    volume: Math.round((document.querySelector('video')?.volume ?? -1) * 1000) / 1000,
    spectrogram: (() => {
      const node = document.querySelector('.video-audio-clip .audio-spectrogram');
      return node ? { ready: node.dataset.ready, columns: Number(node.dataset.columns || 0), width: node.width } : null;
    })(),
  }));

  const setRange = (selector, value) => page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector);
    if (!input) throw new Error(`missing ${selector}`);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  }, { selector, value });

  const seek = value => page.evaluate(value => {
    const input = document.querySelector('input[aria-label="Preview playhead"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

  const report = { loaded: await state() };
  if (report.loaded.bus !== '70%' || report.loaded.volume !== 0.7) throw new Error(`bus not applied: ${JSON.stringify(report.loaded)}`);
  if (report.loaded.fakeWave !== 0) throw new Error('the video lane still draws a waveform');
  await page.waitForFunction(() => document.querySelector('.video-audio-clip .audio-spectrogram')?.dataset.ready === 'true', null, { timeout: 20000 });
  report.spectrogram = await state();
  if (report.spectrogram.spectrogram?.ready !== 'true' || report.spectrogram.spectrogram.columns <= 0) throw new Error(`video spectrogram not drawn: ${JSON.stringify(report.spectrogram.spectrogram)}`);

  await page.locator('.video-audio-clip').nth(1).click();
  await page.waitForTimeout(300);
  await setRange('input[aria-label="Second clip sound level"]', 30);
  await page.waitForTimeout(700);
  await seek(0.6);
  await page.waitForTimeout(500);
  report.clipLevel = await state();
  if (report.clipLevel.clips[1].level !== '30%' || report.clipLevel.volume !== 0.21) throw new Error(`clip level not applied: ${JSON.stringify(report.clipLevel)}`);

  await page.click('.video-audio-row .track-mute');
  await page.waitForTimeout(700);
  report.muted = await state();
  if (report.muted.bus !== '0%' || report.muted.volume !== 0) throw new Error(`mute not applied: ${JSON.stringify(report.muted)}`);

  await page.click('.video-audio-row .track-mute');
  await page.waitForTimeout(700);
  await setRange('input[aria-label="Video audio volume"]', 55);
  await page.waitForTimeout(700);
  report.busLevel = await state();
  if (report.busLevel.bus !== '55%' || report.busLevel.volume !== 0.165) throw new Error(`bus slider not applied: ${JSON.stringify(report.busLevel)}`);

  // Both clips share one source, exactly like the two halves of a split. The
  // second half starts at 1 s; the video must keep running through that cut,
  // not reload and fall back to 0 s (which looked like a half-second loop).
  await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Preview playhead"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, '0');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await page.click('.play-button');
  await page.waitForTimeout(900);
  report.boundary = await page.evaluate(() => {
    const video = document.querySelector('video');
    const input = document.querySelector('input[aria-label="Preview playhead"]');
    return { position: Math.round(Number(input?.value) * 100) / 100, time: video ? Math.round(video.currentTime * 100) / 100 : null, paused: video?.paused ?? null };
  });
  await page.click('.play-button');
  if (!report.boundary.time || report.boundary.time < 0.35) throw new Error(`the video restarted at the shared-source cut: ${JSON.stringify(report.boundary)}`);

  await page.reload();
  const card = page.locator('.project-card', { hasText: 'Mixer browser check' }).first();
  await card.waitFor({ timeout: 15000 });
  await card.locator('.project-open').click();
  await page.waitForSelector('.video-audio-row', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  report.reopened = await state();
  if (report.reopened.bus !== '55%' || report.reopened.volume !== 0.55) throw new Error(`mix not restored: ${JSON.stringify(report.reopened)}`);
  if (report.reopened.clips[1].level !== '30%') throw new Error(`clip level not restored: ${JSON.stringify(report.reopened)}`);

  return { ...report, errors };
}
