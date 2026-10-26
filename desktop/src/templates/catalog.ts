import { defaultFormat, emptyProject, normalizeStarts, projectScenes, secondsToTicks, type FilterId, type Project, type Scene, type TextLayer } from '../stores/model';
import { templateArt, type TemplateKind } from './art';
import { createTextLayer } from '../components/text/layers';

export type TemplateDefinition = {
  id: TemplateKind; name: string; category: 'Travel' | 'Family' | 'Birthday' | 'Product' | 'Social';
  description: string; aspect: Project['aspect']; previewIndex: number; filter: FilterId;
  filterIntensity: number; sceneCount: number; duration: number; build: () => Scene[];
};

type Story = { id: TemplateKind; name: string; category: TemplateDefinition['category']; description: string; aspect: Project['aspect']; color: string; font: string; titles: string[]; captions: string[] };
const STORIES: Story[] = [
  { id: 'travel', name: 'Travel journal', category: 'Travel', description: 'Three photo-led chapters with a quiet title and location caption.', aspect: '16:9', color: '#FFFFFF', font: 'playfair', titles: ['Take the long way.', 'A little off the map.', 'Bring back a story.'], captions: ['01 / THE DEPARTURE', '02 / THE DETOUR', '03 / THE MEMORY'] },
  { id: 'family', name: 'Everyday moments', category: 'Family', description: 'A simple memory reel with a handwritten caption over your photos.', aspect: '4:5', color: '#FFFFFF', font: 'caveat', titles: ['Our kind of Sunday', 'The good little things', 'Keep this feeling'], captions: ['A NOTE TO REMEMBER', 'RIGHT HERE, TOGETHER', 'WITH LOVE, ALWAYS'] },
  { id: 'birthday', name: 'Birthday reel', category: 'Birthday', description: 'A vertical birthday reel with bold editable titles.', aspect: '9:16', color: '#FFFFFF', font: 'bebas-neue', titles: ['YOUR\nDAY.', 'BIG\nWISHES.', 'MORE\nLIFE.'], captions: ['TURN IT UP', 'MAKE THEM COUNT', 'HERE’S TO YOU'] },
  { id: 'product', name: 'Product reveal', category: 'Product', description: 'A clean opening, detail shot, and closing call to action.', aspect: '1:1', color: '#FFFFFF', font: 'space-grotesk', titles: ['Form.\nFeeling.', 'Every detail,\nconsidered.', 'Made to\nstay.'], captions: ['OBJECT / STUDY — 001', 'LESS, WITH PURPOSE', 'THE NEW COLLECTION'] },
  { id: 'social', name: 'Social story', category: 'Social', description: 'Three vertical moments with large readable titles.', aspect: '9:16', color: '#FFFFFF', font: 'archivo-black', titles: ['THIS\nIS IT.', 'KEEP\nGOING.', 'PLAY IT\nAGAIN.'], captions: ['A MOMENT IN MOTION', 'MAKE YOUR OWN MOMENT', 'SAVE THE FEELING'] },
];

function buildStory(story: Story): Scene[] {
  return story.titles.map((title, index) => {
    const durationTicks = secondsToTicks(4);
    const layer = (patch: Partial<TextLayer>) => createTextLayer(durationTicks, { color: story.color, x: .08, y: .19, width: .78, font: story.font, fontWeight: story.id === 'social' || story.id === 'birthday' ? 400 : 600, size: story.id === 'birthday' ? .20 : story.id === 'social' ? .22 : story.id === 'family' ? .12 : .11, lineHeight: 1.05, animation: 'slide-up', animationDuration: .7, ...patch });
    const layers = [
      layer({ title, subtitle: '', y: story.id === 'family' ? .66 : .57, width: story.id === 'product' ? .62 : .8 }),
      layer({ title: story.captions[index], subtitle: '', y: .08, size: .02, font: 'space-grotesk', letterSpacing: .004, animation: 'fade' }),
      layer({ title: `0${index + 1} / 03`, subtitle: '', y: .89, size: .022, font: 'dm-sans', animation: 'fade' }),
    ];
    return {
      id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: title.replaceAll('\n', ' '),
      image: templateArt(story.id, index), durationTicks, title, subtitle: '', color: story.color,
      fit: 'cover', speed: 1, pitch: true, filter: 'none', filterIntensity: 100,
      brightness: 1, contrast: 1, saturation: 1, textX: .08, textY: .19, textWidth: .8, textAlign: 'left', textLayers: layers,
      motion: story.id === 'travel' ? 'zoom-in' : 'none',
      transition: { type: story.id === 'social' ? 'slide-up' : story.id === 'birthday' ? 'circle' : 'fade', duration: .5 },
      elements: [],
    };
  });
}

export const TEMPLATES: TemplateDefinition[] = STORIES.map(story => ({ ...story, previewIndex: 0, filter: 'none', filterIntensity: 100, sceneCount: 3, duration: 12, build: () => buildStory(story) }));
export const SAMPLE_TEMPLATE = TEMPLATES[0];
export function templatePreview(template: TemplateDefinition) { return templateArt(template.id, template.previewIndex); }
export function buildTemplateProject(template: TemplateDefinition, sources: readonly Scene[] = []): Project {
  const project = emptyProject(template.name);
  project.aspect = template.aspect;
  project.formats = [defaultFormat(template.aspect)];
  const track = projectScenes(project) as Scene[];
  const scenes = template.build().map((scene, index) => {
    const source = sources[index % sources.length];
    if (!source) return scene;
    const durationTicks = source.mediaKind === 'video' ? Math.min(scene.durationTicks, source.durationTicks) : scene.durationTicks;
    return { ...scene, image: source.image, mediaKind: source.mediaKind, videoPoster: source.videoPoster, sourceInTicks: source.sourceInTicks, durationTicks,
      motion: source.mediaKind === 'video' ? 'none' as const : scene.motion,
      textLayers: scene.textLayers?.map(layer => ({ ...layer, durationTicks, color: '#FFFFFF', shadowEnabled: true, shadowIntensity: 85, backdropEnabled: true, backdropOpacity: 35 })) };
  });
  track.splice(0, track.length, ...scenes); normalizeStarts(track);
  return project;
}
