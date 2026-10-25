import { defaultFormat, emptyProject, normalizeStarts, projectScenes, sceneSeconds, secondsToTicks, type FilterId, type Project, type Scene, type TextAnimation, type TextLayer } from '../stores/model';
import { templateArt, type TemplateKind } from './art';
import { createTextLayer } from '../components/text/layers';

export type TemplateDefinition = {
  id: TemplateKind;
  name: string;
  category: 'Travel' | 'Family' | 'Birthday' | 'Product' | 'Social';
  description: string;
  aspect: Project['aspect'];
  previewIndex: number;
  filter: FilterId;
  filterIntensity: number;
  sceneCount: number;
  duration: number;
  build: () => Scene[];
};

type SceneLook = Partial<Scene>;

const KICKERS: Record<TemplateKind, string> = {
  travel: 'TRAVEL DIARY',
  family: 'FAMILY ALBUM',
  birthday: 'CELEBRATE',
  product: 'STUDIO DROP',
  social: 'STORY',
};

function storyLayers(kind: TemplateKind, title: string, subtitle: string, durationTicks: number): TextLayer[] {
  const base = { durationTicks, animationDuration: .6 };
  const common = { x: .09, width: .78, align: 'left' as const };
  const kicker = createTextLayer(durationTicks, {
    title: KICKERS[kind], subtitle: '', color: kind === 'product' ? '#34394A' : '#FFFFFF',
    x: .09, y: kind === 'birthday' || kind === 'social' ? .08 : .09, width: .55,
    font: 'space-grotesk', fontWeight: 600, size: .016, letterSpacing: .035, opacity: 88,
    animation: 'slide-left' as TextAnimation, ...base,
  });
  const titleLayer = createTextLayer(durationTicks, {
    title, subtitle: '', color: kind === 'product' ? '#202536' : '#FFFFFF',
    ...common, y: kind === 'birthday' ? .55 : kind === 'social' ? .56 : kind === 'product' ? .68 : .64,
    font: kind === 'travel' ? 'playfair' : kind === 'family' ? 'libre-baskerville' : kind === 'birthday' ? 'bebas-neue' : kind === 'social' ? 'archivo-black' : 'space-grotesk',
    fontWeight: kind === 'birthday' || kind === 'social' ? 400 : kind === 'product' ? 600 : 700,
    size: kind === 'birthday' ? .1 : kind === 'social' ? .078 : kind === 'product' ? .06 : .072,
    lineHeight: kind === 'birthday' || kind === 'social' ? 1.04 : 1.08,
    animation: 'slide-up' as TextAnimation, ...base,
  });
  const sub = createTextLayer(durationTicks, {
    title: subtitle, subtitle: '', color: kind === 'product' ? '#4B5060' : '#F5F1FF',
    ...common, y: kind === 'birthday' ? .68 : kind === 'social' ? .76 : kind === 'product' ? .82 : .78,
    width: .66, font: 'dm-sans', fontWeight: 400, size: .026, lineHeight: 1.25, opacity: 88,
    animation: 'fade' as TextAnimation, ...base,
  });
  if (kind === 'product') {
    kicker.animation = 'fade';
    titleLayer.animation = 'slide-up';
    sub.animation = 'fade';
  }
  if (kind === 'travel' || kind === 'family') {
    for (const layer of [titleLayer, sub, kicker]) {
      layer.shadowEnabled = true;
      layer.shadowColor = '#1B1010';
      layer.shadowIntensity = 62;
      layer.shadowBlur = 14;
      layer.shadowOffsetY = 4;
      layer.outlineEnabled = true;
      layer.strokeColor = '#20130F';
      layer.strokeWidth = kind === 'travel' ? 1.1 : 1.4;
    }
  }
  if (kind === 'birthday' || kind === 'social') {
    for (const layer of [titleLayer, sub, kicker]) {
      layer.glowEnabled = true;
      layer.glowColor = kind === 'birthday' ? '#FFC96B' : '#6BE7FF';
      layer.glowBlur = 24;
      layer.glowIntensity = 38;
      layer.outlineEnabled = true;
      layer.strokeColor = '#170D24';
      layer.strokeWidth = 1.8;
    }
  }
  if (kind === 'family') {
    for (const layer of [titleLayer, sub]) {
      layer.backdropEnabled = true;
      layer.backdropColor = '#2B1712';
      layer.backdropOpacity = 34;
      layer.backdropBlur = 20;
      layer.backdropPadding = 24;
      layer.backdropRadius = 16;
      layer.backdropNoise = 4;
    }
  }
  if (kind === 'product') {
    for (const layer of [titleLayer, sub]) {
      layer.backdropEnabled = true;
      layer.backdropColor = '#FFF8EE';
      layer.backdropOpacity = 76;
      layer.backdropBlur = 22;
      layer.backdropPadding = 22;
      layer.backdropRadius = 13;
      layer.backdropNoise = 2;
    }
  }
  return subtitle ? [titleLayer, kicker, sub] : [titleLayer, kicker];
}

function scene(kind: TemplateKind, name: string, imageIndex: number, title: string, subtitle: string, duration: number, look: SceneLook = {}): Scene {
  return {
    id: crypto.randomUUID(),
    startTicks: 0,
    sourceInTicks: 0,
    name,
    image: templateArt(kind, imageIndex),
    durationTicks: secondsToTicks(duration),
    title,
    subtitle,
    color: '#FFFFFF',
    fit: 'cover',
    speed: 1,
    pitch: true,
    filter: 'none',
    filterIntensity: 100,
    brightness: 1,
    contrast: 1,
    saturation: 1,
    textX: .09,
    textY: .72,
    textWidth: .7,
    textAlign: 'left',
    textLayers: storyLayers(kind, title, subtitle, secondsToTicks(duration)),
    transition: kind === 'social' ? { type: 'slide', duration: .4 } : { type: 'fade', duration: .55 },
    ...look,
  };
}

const TRAVEL: Scene[] = [
  scene('travel', 'Morning in the mountains', 0, 'A little further', 'Small moments. Bigger stories.', 4, {
    filter: 'warm', filterIntensity: 58,
    color: '#FFF8EC', textX: .08, textY: .73, textWidth: .68,
    textFont: 'playfair', textFontWeight: 700, textSize: .078,
    textOutlineEnabled: true, textStrokeColor: '#1C2A32', textStrokeWidth: 1,
    textShadowEnabled: true, textShadowColor: '#101820', textShadowIntensity: 45, textShadowBlur: 12, textShadowOffsetY: 3,
  }),
  scene('travel', 'The scenic route', 1, 'Find your own pace', 'Take the road that feels right.', 4, {
    filter: 'warm', filterIntensity: 52,
    color: '#FFF8EC', textX: .08, textY: .73, textWidth: .68,
    textFont: 'playfair', textFontWeight: 700, textSize: .074,
    textOutlineEnabled: true, textStrokeColor: '#1C2A32', textStrokeWidth: 1,
    textShadowEnabled: true, textShadowColor: '#101820', textShadowIntensity: 45, textShadowBlur: 12, textShadowOffsetY: 3,
  }),
  scene('travel', 'A quieter place', 2, 'Stay for the view', 'Some places ask you to slow down.', 4.5, {
    filter: 'warm', filterIntensity: 58,
    color: '#FFF8EC', textX: .08, textY: .72, textWidth: .68,
    textFont: 'playfair', textFontWeight: 700, textSize: .078,
    textOutlineEnabled: true, textStrokeColor: '#1C2A32', textStrokeWidth: 1,
    textShadowEnabled: true, textShadowColor: '#101820', textShadowIntensity: 45, textShadowBlur: 12, textShadowOffsetY: 3,
  }),
];

const FAMILY: Scene[] = [
  scene('family', 'Sunday morning', 0, 'The little moments', 'They grow up so fast.', 3.5, {
    filter: 'film', filterIntensity: 38, brightness: 1.04,
    color: '#FFF8F0', textX: .1, textY: .69, textWidth: .72,
    textFont: 'libre-baskerville', textFontWeight: 700, textSize: .062, textLineHeight: 1.18,
    textBackdropEnabled: true, textBackdropColor: '#3A211C', textBackdropOpacity: 34, textBackdropBlur: 20, textBackdropPadding: 26, textBackdropRadius: 16, textBackdropNoise: 5,
    textShadowEnabled: true, textShadowColor: '#2C1714', textShadowIntensity: 38, textShadowBlur: 14, textShadowOffsetY: 3,
  }),
  scene('family', 'Together', 1, 'Together, always', 'Sunday mornings, unhurried.', 4, {
    filter: 'film', filterIntensity: 38,
    color: '#FFF8F0', textX: .1, textY: .69, textWidth: .72,
    textFont: 'libre-baskerville', textFontWeight: 700, textSize: .062, textLineHeight: 1.18,
    textBackdropEnabled: true, textBackdropColor: '#3A211C', textBackdropOpacity: 34, textBackdropBlur: 20, textBackdropPadding: 26, textBackdropRadius: 16, textBackdropNoise: 5,
    textShadowEnabled: true, textShadowColor: '#2C1714', textShadowIntensity: 38, textShadowBlur: 14, textShadowOffsetY: 3,
  }),
  scene('family', 'A day to remember', 2, 'Home is us', 'Keep this one close.', 4, {
    filter: 'film', filterIntensity: 38,
    color: '#FFF8F0', textX: .1, textY: .69, textWidth: .72,
    textFont: 'libre-baskerville', textFontWeight: 700, textSize: .062, textLineHeight: 1.18,
    textBackdropEnabled: true, textBackdropColor: '#3A211C', textBackdropOpacity: 34, textBackdropBlur: 20, textBackdropPadding: 26, textBackdropRadius: 16, textBackdropNoise: 5,
    textShadowEnabled: true, textShadowColor: '#2C1714', textShadowIntensity: 38, textShadowBlur: 14, textShadowOffsetY: 3,
  }),
];

const BIRTHDAY: Scene[] = [
  scene('birthday', 'Make a wish', 0, 'MAKE A WISH', 'This year is yours.', 3.5, {
    filter: 'vivid', filterIntensity: 42,
    color: '#FFF8E8', textX: .1, textY: .64, textWidth: .76,
    textFont: 'bebas-neue', textFontWeight: 400, textSize: .1, textLineHeight: 1,
    textBackdropEnabled: true, textBackdropColor: '#1B0D2A', textBackdropOpacity: 26, textBackdropBlur: 18, textBackdropPadding: 22, textBackdropRadius: 14, textBackdropNoise: 6,
    textGlowEnabled: true, textGlowColor: '#FFC96B', textGlowBlur: 26, textGlowIntensity: 45,
  }),
  scene('birthday', 'Confetti', 1, 'CONFETTI TIME', 'Celebrate everything.', 3.5, {
    filter: 'vivid', filterIntensity: 45,
    color: '#FFF8E8', textX: .1, textY: .64, textWidth: .76,
    textFont: 'bebas-neue', textFontWeight: 400, textSize: .1, textLineHeight: 1,
    textBackdropEnabled: true, textBackdropColor: '#1B0D2A', textBackdropOpacity: 26, textBackdropBlur: 18, textBackdropPadding: 22, textBackdropRadius: 14, textBackdropNoise: 6,
    textGlowEnabled: true, textGlowColor: '#FF8DC7', textGlowBlur: 28, textGlowIntensity: 50,
  }),
  scene('birthday', "Here's to you", 2, "HERE'S TO YOU", 'Another year, another adventure.', 4, {
    filter: 'vivid', filterIntensity: 40,
    color: '#FFF8E8', textX: .1, textY: .64, textWidth: .76,
    textFont: 'bebas-neue', textFontWeight: 400, textSize: .1, textLineHeight: 1,
    textBackdropEnabled: true, textBackdropColor: '#1B0D2A', textBackdropOpacity: 26, textBackdropBlur: 18, textBackdropPadding: 22, textBackdropRadius: 14, textBackdropNoise: 6,
    textGlowEnabled: true, textGlowColor: '#8F7CFF', textGlowBlur: 26, textGlowIntensity: 45,
  }),
];

const PRODUCT: Scene[] = [
  scene('product', 'The collection', 0, 'Made for you', 'Considered in every detail.', 4, {
    filter: 'cool', filterIntensity: 24,
    color: '#232A3D', textX: .08, textY: .72, textWidth: .68,
    textFont: 'space-grotesk', textFontWeight: 600, textSize: .056,
    textBackdropEnabled: true, textBackdropColor: '#FFF8EE', textBackdropOpacity: 78, textBackdropBlur: 22, textBackdropPadding: 24, textBackdropRadius: 14, textBackdropNoise: 2,
    textShadowEnabled: false,
  }),
  scene('product', 'Designed to last', 1, 'Designed to last', 'Quietly built. Naturally yours.', 4.5, {
    filter: 'cool', filterIntensity: 24,
    color: '#232A3D', textX: .08, textY: .72, textWidth: .68,
    textFont: 'space-grotesk', textFontWeight: 600, textSize: .056,
    textBackdropEnabled: true, textBackdropColor: '#FFF8EE', textBackdropOpacity: 78, textBackdropBlur: 22, textBackdropPadding: 24, textBackdropRadius: 14, textBackdropNoise: 2,
    textShadowEnabled: false,
  }),
  scene('product', 'Yours to keep', 2, 'Yours to keep', 'A small object. A long story.', 4, {
    filter: 'cool', filterIntensity: 24,
    color: '#232A3D', textX: .08, textY: .72, textWidth: .68,
    textFont: 'space-grotesk', textFontWeight: 600, textSize: .056,
    textBackdropEnabled: true, textBackdropColor: '#FFF8EE', textBackdropOpacity: 78, textBackdropBlur: 22, textBackdropPadding: 24, textBackdropRadius: 14, textBackdropNoise: 2,
    textShadowEnabled: false,
  }),
];

const SOCIAL: Scene[] = [
  scene('social', 'Stay for the view', 0, 'You had to be there', 'A moment worth sharing.', 3.5, {
    filter: 'none', filterIntensity: 100,
    color: '#FFFFFF', textX: .1, textY: .62, textWidth: .78,
    textFont: 'archivo-black', textFontWeight: 400, textSize: .078, textLineHeight: 1.08,
    textOutlineEnabled: true, textStrokeColor: '#1A0A2E', textStrokeWidth: 2,
    textGlowEnabled: true, textGlowColor: '#FFB6D5', textGlowBlur: 26, textGlowIntensity: 35,
  }),
  scene('social', 'A moment', 1, 'Main character energy', 'No notes.', 3.5, {
    filter: 'none', filterIntensity: 100,
    color: '#FFFFFF', textX: .1, textY: .62, textWidth: .78,
    textFont: 'archivo-black', textFontWeight: 400, textSize: .078, textLineHeight: 1.08,
    textOutlineEnabled: true, textStrokeColor: '#1A0A2E', textStrokeWidth: 2,
    textGlowEnabled: true, textGlowColor: '#9B7CFF', textGlowBlur: 28, textGlowIntensity: 40,
  }),
  scene('social', 'See you out there', 2, 'See you out there', 'Save this one.', 4, {
    filter: 'none', filterIntensity: 100,
    color: '#FFFFFF', textX: .1, textY: .62, textWidth: .78,
    textFont: 'archivo-black', textFontWeight: 400, textSize: .078, textLineHeight: 1.08,
    textOutlineEnabled: true, textStrokeColor: '#1A0A2E', textStrokeWidth: 2,
    textGlowEnabled: true, textGlowColor: '#7FE7FF', textGlowBlur: 24, textGlowIntensity: 32,
  }),
];

export const TEMPLATES: TemplateDefinition[] = [
  { id: 'travel', name: 'Travel', category: 'Travel', description: 'Warm, cinematic frames for the long way around.', aspect: '16:9', previewIndex: 0, filter: 'warm', filterIntensity: 55, sceneCount: TRAVEL.length, duration: TRAVEL.reduce((sum, item) => sum + sceneSeconds(item), 0), build: () => TRAVEL.map(item => ({ ...item, id: crypto.randomUUID() })) },
  { id: 'family', name: 'Family', category: 'Family', description: 'Sunlit, keepsake frames for the people who matter most.', aspect: '4:5', previewIndex: 0, filter: 'film', filterIntensity: 38, sceneCount: FAMILY.length, duration: FAMILY.reduce((sum, item) => sum + sceneSeconds(item), 0), build: () => FAMILY.map(item => ({ ...item, id: crypto.randomUUID() })) },
  { id: 'birthday', name: 'Birthday', category: 'Birthday', description: 'Cake, confetti, and a little glow for the big day.', aspect: '9:16', previewIndex: 0, filter: 'vivid', filterIntensity: 42, sceneCount: BIRTHDAY.length, duration: BIRTHDAY.reduce((sum, item) => sum + sceneSeconds(item), 0), build: () => BIRTHDAY.map(item => ({ ...item, id: crypto.randomUUID() })) },
  { id: 'product', name: 'Product', category: 'Product', description: 'A clean studio story for an object worth noticing.', aspect: '1:1', previewIndex: 0, filter: 'cool', filterIntensity: 24, sceneCount: PRODUCT.length, duration: PRODUCT.reduce((sum, item) => sum + sceneSeconds(item), 0), build: () => PRODUCT.map(item => ({ ...item, id: crypto.randomUUID() })) },
  { id: 'social', name: 'Social', category: 'Social', description: 'Bold, high-contrast vertical titles for a feed-ready moment.', aspect: '9:16', previewIndex: 0, filter: 'none', filterIntensity: 100, sceneCount: SOCIAL.length, duration: SOCIAL.reduce((sum, item) => sum + sceneSeconds(item), 0), build: () => SOCIAL.map(item => ({ ...item, id: crypto.randomUUID() })) },
];

export const SAMPLE_TEMPLATE = TEMPLATES[0];

export function templatePreview(template: TemplateDefinition) {
  return templateArt(template.id, template.previewIndex);
}

export function buildTemplateProject(template: TemplateDefinition): Project {
  const project = emptyProject(template.name);
  project.aspect = template.aspect;
  project.formats = [defaultFormat(template.aspect)];
  const track = projectScenes(project) as Scene[];
  track.splice(0, track.length, ...template.build());
  normalizeStarts(track);
  return project;
}
