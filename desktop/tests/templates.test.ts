import { describe, it, expect } from 'vitest';
import { validateProject, type Scene } from '../src/stores/model';
import { TEMPLATE_CATEGORIES, TEMPLATES, buildTemplateProject, templatePreview } from '../src/templates/catalog';
import { TEMPLATE_AUDIO, TEMPLATE_VIDEO } from '../src/templates/media';
import { TEMPLATE_PHOTOS, templatePhotoUrl, type TemplatePhotoId } from '../src/templates/photos';

const stub = (id: string) => `data:image/jpeg;base64,${btoa(id)}`;
const loader = async (id: TemplatePhotoId) => stub(id);
const audioLoader = async () => 'data:audio/mp4;base64,AA==';
const videoLoader = async () => 'data:video/mp4;base64,AA==';
const posterLoader = async () => stub('poster');
const build = (template: (typeof TEMPLATES)[number], sources: Scene[] = []) => buildTemplateProject(template, sources, loader, videoLoader, posterLoader, audioLoader);

describe('bundled templates', () => {
  it('ships three bundled photos for every story, all from the CC0 catalogue', () => {
    for (const template of TEMPLATES) {
      expect(template.photos, template.id).toHaveLength(3);
      for (const photo of template.photos) {
        expect(TEMPLATE_PHOTOS[photo], `${template.id} → ${photo}`).toBeTruthy();
        expect(TEMPLATE_PHOTOS[photo].license).toBe('CC0');
        expect(TEMPLATE_PHOTOS[photo].source).toContain('commons.wikimedia.org');
      }
      expect(template.sceneCount).toBe(3);
      expect(template.duration).toBeCloseTo(template.seconds * 3, 5);
      expect(['16:9', '9:16', '1:1', '4:5']).toContain(template.aspect);
      expect(TEMPLATE_CATEGORIES).toContain(template.category);
      expect(template.titles).toHaveLength(3);
      expect(template.captions).toHaveLength(3);
    }
  });

  it('keeps story ids and names unique and previews an existing bundled file', () => {
    expect(new Set(TEMPLATES.map(template => template.id)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATES.map(template => template.name)).size).toBe(TEMPLATES.length);
    expect(new Set(TEMPLATE_CATEGORIES).size).toBe(TEMPLATE_CATEGORIES.length);
    for (const template of TEMPLATES) {
      expect(templatePreview(template)).toMatch(template.video ? /\/templates\/media\/aurora-motion\.jpg$/ : /\/templates\/[a-z-]+\.jpg$/);
      if (!template.video) expect(templatePreview(template)).toBe(templatePhotoUrl(template.photos[0]));
    }
    // Every bundled file is listed once and has a usable id.
    for (const [id, photo] of Object.entries(TEMPLATE_PHOTOS)) {
      expect(photo.file).toBe(`${id}.jpg`);
      expect(photo.author.length).toBeGreaterThan(0);
    }
  });

  it('builds a valid, editable project that embeds the photos', async () => {
    for (const template of TEMPLATES) {
      const project = await build(template);
      const validated = validateProject(JSON.parse(JSON.stringify(project)));
      const scenes = validated.tracks[0].clips;
      expect(scenes).toHaveLength(3);
      expect(validated.aspect).toBe(template.aspect);
      expect(validated.formats[0].aspect).toBe(template.aspect);
      scenes.forEach((scene, index) => {
        if (template.video) {
          expect(scene.image).toBe('data:video/mp4;base64,AA==');
          expect(scene.mediaKind).toBe('video');
          expect(scene.sourceDurationSeconds).toBe(TEMPLATE_VIDEO[template.video].duration);
        } else {
          expect(scene.image).toBe(stub(template.photos[index]));
          expect(scene.mediaKind).toBeUndefined();
        }
        expect(scene.textLayers?.[0].title).toBe(template.titles[index]);
        // The caption and the "01 / 03" counter are editable layers too.
        expect(scene.textLayers?.length).toBeGreaterThanOrEqual(3);
        if (template.video) expect(scene.transition).toBeNull();
        else expect(scene.transition?.type).toBe(template.transition);
        expect(scene.durationTicks).toBeGreaterThan(0);
      });
      // Scenes are laid end to end so the story plays without gaps.
      expect(scenes[0].startTicks).toBe(0);
      expect(scenes[1].startTicks).toBe(scenes[0].durationTicks);
      expect(scenes[2].startTicks).toBe(scenes[0].durationTicks + scenes[1].durationTicks);
    }
  });

  it('places your own photos in the template scenes', async () => {
    const template = TEMPLATES[0];
    const photo = (id: string, durationTicks = 120): Scene => ({
      id, name: id, image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0,
      durationTicks, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover',
    });
    const video: Scene = { ...photo('clip'), image: 'data:video/mp4;base64,AA==', mediaKind: 'video', sourceInTicks: 30, videoPoster: 'data:image/png;base64,AA==', durationTicks: 30 };
    const project = await build(template, [photo('a'), video]);
    const scenes = validateProject(JSON.parse(JSON.stringify(project))).tracks[0].clips;
    expect(scenes[0].image).toBe('data:image/png;base64,AA==');
    expect(scenes[1].mediaKind).toBe('video');
    expect(scenes[1].image).toBe('data:video/mp4;base64,AA==');
    expect(scenes[1].durationTicks).toBe(30);
    expect(scenes[1].motion).toBe('none');
    // A user's clip is never stretched past its own length.
    expect(scenes[1].durationTicks).toBeLessThanOrEqual(30);
    expect(scenes[2].image).toBe('data:image/png;base64,AA==');
  });

  it('still opens a template when a photo cannot be read', async () => {
    const template = TEMPLATES.find(item => !item.video)!;
    const failing = async () => { throw new Error('offline'); };
    const project = await buildTemplateProject(template, [], failing, videoLoader, posterLoader, audioLoader);
    const scenes = validateProject(JSON.parse(JSON.stringify(project))).tracks[0].clips;
    for (const scene of scenes) expect(scene.image.startsWith('data:image/')).toBe(true);
    expect(scenes).toHaveLength(3);
  });

  it('ships a video opener and a generated score for templates', async () => {
    const videoTemplate = TEMPLATES.find(item => item.video)!;
    expect(videoTemplate).toBeTruthy();
    const project = await build(videoTemplate);
    const scenes = validateProject(JSON.parse(JSON.stringify(project))).tracks[0].clips;
    expect(scenes).toHaveLength(3);
    for (const scene of scenes) {
      expect(scene.mediaKind).toBe('video');
      expect(scene.image).toBe('data:video/mp4;base64,AA==');
      expect(scene.videoPoster).toBe(stub('poster'));
      expect(scene.sourceDurationSeconds).toBe(6);
    }
    expect(scenes.map(scene => scene.sourceInTicks)).toEqual([0, 60, 120]);
    expect(project.audio).toHaveLength(1);
    expect(project.audio[0].name).toBe(TEMPLATE_AUDIO['night-drive'].title);
    expect(project.audio[0].durationTicks).toBe(180);
    expect(project.audio[0].sourceDurationSeconds).toBe(20);
    for (const template of TEMPLATES) {
      expect(template.audio).toBeTruthy();
      expect(TEMPLATE_AUDIO[template.audio!].license).toBe('CC0');
    }
  });

  it('keeps every story visually distinct', () => {
    const signatures = new Set(TEMPLATES.map(template => `${template.font}/${template.size}/${template.align ?? 'left'}/${template.category}`));
    expect(signatures.size).toBe(TEMPLATES.length);
  });
});
