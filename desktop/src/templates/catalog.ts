import { ELEMENT_CATALOG } from '../components/elements/catalog';
import { presetSize } from '../components/elements/designer';
import { defaultFormat, emptyProject, normalizeStarts, projectScenes, secondsToTicks, type FilterId, type Project, type Scene, type TextLayer } from '../stores/model';
import { bundledPhotoDataUrl, templatePhotoDataUrl, templatePhotoUrl, FALLBACK_PHOTO_FILE, type TemplatePhotoId } from './photos';
import { TEMPLATE_AUDIO, TEMPLATE_VIDEO, templateAudioDataUrl, templateVideoDataUrl, templateVideoPosterDataUrl, templateVideoPosterUrl, type TemplateAudioId, type TemplateVideoId } from './media';
import { createTextLayer } from '../components/text/layers';

export const TEMPLATE_CATEGORIES = ['Nature', 'Travel', 'People', 'Family', 'Birthday', 'Social', 'Food'] as const;
export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

type StorySpec = {
  id: string; name: string; category: TemplateCategory; description: string;
  photos: [TemplatePhotoId, TemplatePhotoId, TemplatePhotoId];
  titles: [string, string, string]; captions: [string, string, string];
  aspect: Project['aspect']; seconds: number;
  font: string; weight?: number; size?: number; lineHeight?: number; letterSpacing?: number;
  italic?: boolean; align?: 'left' | 'center'; x?: number; y?: number; width?: number;
  backdrop?: number; motion?: Scene['motion']; transition: NonNullable<Scene['transition']>['type'];
  filter?: FilterId; filterIntensity?: number; accent?: string;
  /** Video templates use a bundled motion background and a generated score. */
  kind?: 'photo' | 'video'; video?: TemplateVideoId; audio?: TemplateAudioId; audioVolume?: number;
};

export type TemplateDefinition = StorySpec & { sceneCount: number; duration: number; build: (images: string[]) => Scene[] };

/** A 1×1 image keeps a scene valid if even the fallback file cannot be read. */
const BLANK_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

/** Turns a story description into three editable scenes that share one look. */
export function buildStory(spec: StorySpec, images: string[]): Scene[] {
  const durationTicks = secondsToTicks(spec.seconds);
  const color = '#FFFFFF';
  const titleY = spec.y ?? .6;
  const size = spec.size ?? .1;
  const weight = spec.weight ?? 600;
  return spec.titles.map((title, index) => {
    const layer = (patch: Partial<TextLayer>) => createTextLayer(durationTicks, {
      color, x: spec.x ?? .08, y: titleY, width: spec.width ?? .8, font: spec.font,
      fontWeight: weight, fontStyle: spec.italic ? 'italic' : 'normal',
      size, lineHeight: spec.lineHeight ?? 1.04, letterSpacing: spec.letterSpacing ?? 0,
      align: spec.align ?? 'left',
      backdropEnabled: Boolean(spec.backdrop), backdropOpacity: spec.backdrop ?? 0,
      backdropBlur: 26, backdropPadding: 26, backdropRadius: 18,
      shadowEnabled: true, shadowIntensity: 70, shadowBlur: 18, shadowOffsetY: 4,
      animation: 'slide-up', animationDuration: .7, ...patch,
    });
    const layers = [
      layer({ title }),
      layer({ title: spec.captions[index], y: .075, size: .019, font: 'space-grotesk', fontWeight: 500, letterSpacing: .006, backdropEnabled: false, shadowEnabled: false, animation: 'fade' }),
      layer({ title: `0${index + 1} / 03`, y: .9, size: .02, font: 'dm-sans', fontWeight: 400, shadowEnabled: false, animation: 'fade' }),
    ];
    const scene: Scene = {
      id: crypto.randomUUID(), startTicks: 0, sourceInTicks: 0, name: title.replaceAll('\n', ' '),
      image: images[index] ?? images[0] ?? BLANK_PHOTO, durationTicks, title, subtitle: '', color,
      fit: 'cover', speed: 1, pitch: true,
      filter: spec.filter ?? 'none', filterIntensity: spec.filterIntensity ?? 100,
      brightness: 1, contrast: 1, saturation: 1,
      textX: spec.x ?? .08, textY: titleY, textWidth: spec.width ?? .8, textAlign: spec.align ?? 'left',
      textLayers: layers,
      motion: spec.motion ?? 'none',
      transition: { type: spec.transition, duration: .5 },
      elements: spec.category === 'Social' && index === 2 ? (() => {
        const preset = ELEMENT_CATALOG.find(p => p.id === (spec.id === 'motion-opener' ? 'buttons-motion-01' : 'buttons-motion-02'))!;
        const [aw,ah] = spec.aspect.split(':').map(Number);
        return [{id:crypto.randomUUID(),kind:preset.kind,presetId:preset.id,label:preset.text,x:.5,y:.8,...presetSize(preset,{width:aw*100,height:ah*100}),rotation:0,color:preset.color,opacity:100,startTicks:0,durationTicks,animation:preset.animation}];
      })() : [],
    };
    return scene;
  });
}

const STORIES: StorySpec[] = [
  {
    id: 'wild-escape', name: 'Wild escape', category: 'Nature',
    description: 'Bold condensed type over valleys, pines and river mist.',
    photos: ['nature-valley', 'nature-pines', 'nature-river'],
    titles: ['GO\nOUTSIDE.', 'BREATHE\nDEEP.', 'STAY\nWILD.'],
    captions: ['01 / THE TRAILHEAD', '02 / THE QUIET PART', '03 / THE WAY BACK'],
    aspect: '16:9', seconds: 4, font: 'bebas-neue', size: .19, lineHeight: .92, align: 'left', y: .5,
    backdrop: 22, motion: 'zoom-in', transition: 'fade', accent: '#E8FF6A',
  },
  {
    id: 'motion-opener', name: 'Motion opener', category: 'Social', kind: 'video', video: 'aurora-motion',
    description: 'A six-second animated opener with generated music, built for titles over motion.',
    photos: ['nature-aurora', 'nature-mist', 'nature-ridge'],
    titles: ['MOVE\nWITH IT.', 'KEEP\nGOING.', 'ONE\nMORE.'],
    captions: ['A NEW CHAPTER', 'IN MOTION', 'OUT NOW'],
    aspect: '16:9', seconds: 2, font: 'bebas-neue', size: .2, lineHeight: .92, align: 'center', x: .1, y: .5, width: .8,
    backdrop: 18, transition: 'fade', accent: '#FFD166', audio: 'night-drive', audioVolume: .62,
  },
  {
    id: 'golden-hour', name: 'Golden hour', category: 'Nature',
    description: 'Warm serif titles for sunset, balloons and slow light.',
    photos: ['coast-sunset', 'sky-balloon', 'nature-ridge'],
    titles: ['Chase the light.', 'A little higher.', 'Stay for the colours.'],
    captions: ['GOLDEN HOUR', 'NO RUSH', 'LAST LIGHT'],
    aspect: '16:9', seconds: 4.2, font: 'playfair', italic: true, size: .092, align: 'center', x: .1, y: .58, width: .8,
    backdrop: 18, motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 40,
  },
  {
    id: 'mountain-air', name: 'Mountain air', category: 'Nature',
    description: 'Vertical lettering for peaks, cloud inversions and aurora.',
    photos: ['nature-peak', 'nature-mist', 'nature-aurora'],
    titles: ['ABOVE\nTHE CLOUDS', 'UP HERE,\nNOTHING RUSHES', 'NIGHT\nSKY'],
    captions: ['ALTITUDE', 'THIN AIR', 'AURORA'],
    aspect: '9:16', seconds: 3.6, font: 'archivo-black', size: .12, lineHeight: .98, y: .58, width: .84,
    backdrop: 26, motion: 'zoom-out', transition: 'slide-up', accent: '#FFFFFF',
  },
  {
    id: 'coastline', name: 'Coastline', category: 'Travel',
    description: 'Clean, quiet captions for waves, rocks and long beaches.',
    photos: ['coast-waves', 'coast-rocks', 'people-splash'],
    titles: ['Salt in the air.', 'Nowhere to be.', 'One more swim.'],
    captions: ['THE COAST', 'OFF SEASON', 'LAST DIP'],
    aspect: '16:9', seconds: 4, font: 'space-grotesk', weight: 500, size: .082, y: .62, width: .62,
    motion: 'pan-right', transition: 'fade', filter: 'cool', filterIntensity: 30,
  },
  {
    id: 'city-nights', name: 'City nights', category: 'Travel',
    description: 'Night-market energy with tall condensed headlines.',
    photos: ['street-night', 'city-venice', 'fashion-car'],
    titles: ['AFTER\nDARK', 'STILL\nOPEN', 'CITY\nLIGHTS'],
    captions: ['22:40', 'LAST ORDERS', 'WALK HOME'],
    aspect: '9:16', seconds: 3.4, font: 'bebas-neue', size: .2, lineHeight: .92, y: .5,
    backdrop: 20, motion: 'ken-burns', transition: 'slide-up', accent: '#FF4D6D',
  },
  {
    id: 'weekend-away', name: 'Weekend away', category: 'Travel',
    description: 'A four-by-five road-trip diary with understated captions.',
    photos: ['road-truck', 'people-snow', 'nature-river'],
    titles: ['Two tanks\nand a map.', 'Cold hands,\nfull camera.', 'Home by\nSunday.'],
    captions: ['FRIDAY', 'SATURDAY', 'SUNDAY'],
    aspect: '4:5', seconds: 3.8, font: 'dm-sans', weight: 600, size: .078, lineHeight: 1.12, y: .64,
    motion: 'pan-left', transition: 'fade', filter: 'film', filterIntensity: 35,
  },
  {
    id: 'everyday-moments', name: 'Everyday moments', category: 'Family',
    description: 'Handwritten notes over the small, ordinary bits.',
    photos: ['friends-boys', 'couple-cozy', 'people-window'],
    titles: ['Our kind of Sunday', 'The good little things', 'Keep this feeling'],
    captions: ['A NOTE TO REMEMBER', 'RIGHT HERE, TOGETHER', 'WITH LOVE, ALWAYS'],
    aspect: '4:5', seconds: 4.2, font: 'caveat', weight: 600, size: .125, lineHeight: 1.02, y: .66,
    backdrop: 18, transition: 'fade',
  },
  {
    id: 'best-friends', name: 'Best friends', category: 'Social',
    description: 'Loud, punchy type for group photos and loud nights.',
    photos: ['friends-girls', 'action-jump', 'food-brunch'],
    titles: ['GOOD\nPEOPLE.', 'SAME\nCHAOS.', 'AGAIN\nTOMORROW.'],
    captions: ['THE GROUP CHAT', 'NO PLANS, BEST NIGHT', 'SAME TIME NEXT WEEK'],
    aspect: '9:16', seconds: 3.2, font: 'archivo-black', size: .15, lineHeight: .96, y: .5,
    backdrop: 24, motion: 'zoom-in', transition: 'circle', accent: '#FFD166',
  },
  {
    id: 'birthday-reel', name: 'Birthday reel', category: 'Birthday',
    description: 'Big vertical type, confetti transitions, zero subtlety.',
    photos: ['action-jump', 'food-brunch', 'coffee-friends'],
    titles: ['YOUR\nDAY.', 'BIG\nWISHES.', 'MORE\nLIFE.'],
    captions: ['TURN IT UP', 'MAKE THEM COUNT', 'HERE’S TO YOU'],
    aspect: '9:16', seconds: 3.2, font: 'bebas-neue', size: .23, lineHeight: .9, align: 'center', x: .1, y: .46, width: .8,
    backdrop: 20, motion: 'zoom-out', transition: 'circle', accent: '#FFB3C7',
  },
  {
    id: 'cafe-diary', name: 'Café diary', category: 'Food',
    description: 'Slow serif captions for brunch, coffee and street food.',
    photos: ['coffee-friends', 'food-street', 'food-brunch'],
    titles: ['Slow mornings.', 'Eat where they eat.', 'One more cup.'],
    captions: ['CAFÉ DIARY', 'MARKET DAY', 'STAY A WHILE'],
    aspect: '1:1', seconds: 3.6, font: 'playfair', italic: true, size: .078, y: .6, width: .7,
    motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 45,
  },
  {
    id: 'portrait-study', name: 'Portrait study', category: 'People',
    description: 'Editorial framing and tracked-out labels for portraits.',
    photos: ['people-portrait', 'people-man', 'people-shore'],
    titles: ['STUDY 01', 'STUDY 02', 'STUDY 03'],
    captions: ['NATURAL LIGHT', 'BETWEEN TAKES', 'THE LONG WAY HOME'],
    aspect: '4:5', seconds: 3.6, font: 'space-grotesk', weight: 500, size: .062, letterSpacing: .012, y: .66, width: .8,
    motion: 'none', transition: 'fade', filter: 'noir', filterIntensity: 25, accent: '#FFFFFF',
  },
  {
    id: 'love-story', name: 'Love story', category: 'People',
    description: 'Soft serif lines for couples, weddings and hand-in-hand walks.',
    photos: ['couple-beach', 'couple-sunset', 'hands-autumn'],
    titles: ['You, me,\ngolden light.', 'Still my\nfavourite person.', 'Hold on\na bit longer.'],
    captions: ['THE TWO OF US', 'NO REASON NEEDED', 'AND THEN SOME'],
    aspect: '9:16', seconds: 4, font: 'playfair', italic: true, size: .095, lineHeight: 1.08, align: 'center', x: .1, y: .6, width: .8,
    backdrop: 16, motion: 'ken-burns', transition: 'fade', filter: 'dream', filterIntensity: 30,
  },
  {
    id: 'wedding-day', name: 'Wedding day', category: 'People',
    description: 'Quiet serif promises over the ceremony and the after-party.',
    photos: ['couple-wedding', 'couple-beach', 'hands-autumn'],
    titles: ['I do.', 'Just us, then.', 'Forever starts\non a Tuesday.'],
    captions: ['THE DAY', 'THE GOLDEN HOUR', 'THE REST OF IT'],
    aspect: '9:16', seconds: 4, font: 'playfair', size: .1, lineHeight: 1.06, align: 'center', x: .1, y: .62, width: .8,
    backdrop: 14, motion: 'zoom-in', transition: 'fade', filter: 'film', filterIntensity: 25,
  },
];

export const TEMPLATES: TemplateDefinition[] = STORIES.map(spec => ({
  ...spec,
  kind: spec.kind ?? 'photo',
  audio: spec.audio ?? (['Social', 'Birthday', 'Food'].includes(spec.category) ? 'night-drive' : 'soft-pulse'),
  audioVolume: spec.audioVolume ?? (spec.kind === 'video' ? .6 : .48),
  sceneCount: 3,
  duration: spec.seconds * 3,
  build: (images: string[]) => buildStory(spec, images),
}));

export const SAMPLE_TEMPLATE = TEMPLATES[0];

/** Gallery artwork: the story's first bundled photo, or a video poster. */
export function templatePreview(template: TemplateDefinition) {
  return template.video ? templateVideoPosterUrl(template.video) : templatePhotoUrl(template.photos[0]);
}

/**
 * Builds the project behind a template. Photos are read from the app bundle and
 * embedded as data URLs (that is how a saved story stays self-contained); a
 * neutral placeholder stands in if one file cannot be read, so a template always
 * opens. `load` is injectable for tests.
 */
export async function buildTemplateProject(
  template: TemplateDefinition,
  sources: readonly Scene[] = [],
  load: (id: TemplatePhotoId) => Promise<string> = templatePhotoDataUrl,
  loadVideo: (id: TemplateVideoId) => Promise<string> = templateVideoDataUrl,
  loadPoster: (id: TemplateVideoId) => Promise<string> = templateVideoPosterDataUrl,
  loadAudio: (id: TemplateAudioId) => Promise<string> = templateAudioDataUrl,
): Promise<Project> {
  const images = await Promise.all(template.photos.map(async id => {
    try {
      return await load(id);
    } catch {
      try {
        return await bundledPhotoDataUrl(FALLBACK_PHOTO_FILE);
      } catch {
        return BLANK_PHOTO;
      }
    }
  }));
  const project = emptyProject(template.name);
  project.aspect = template.aspect;
  project.formats = [defaultFormat(template.aspect)];
  const track = projectScenes(project) as Scene[];
  let scenes = template.build(images).map((scene, index) => {
    const source = sources[index % Math.max(1, sources.length)];
    if (!source) return scene;
    const durationTicks = source.mediaKind === 'video' ? Math.min(scene.durationTicks, source.durationTicks) : scene.durationTicks;
    return {
      ...scene, image: source.image, mediaKind: source.mediaKind, videoPoster: source.videoPoster,
      sourceInTicks: source.sourceInTicks, durationTicks,
      motion: source.mediaKind === 'video' ? 'none' as const : scene.motion,
      // Your photo replaces the bundled one, so keep the type readable without
      // flattening the design: a strong shadow always, a backdrop only where the
      // template already uses one.
      textLayers: scene.textLayers?.map(layer => ({
        ...layer, durationTicks, color: '#FFFFFF',
        shadowEnabled: true, shadowIntensity: 90, shadowBlur: 24, shadowOffsetY: 6,
        backdropOpacity: layer.backdropEnabled ? Math.max(layer.backdropOpacity, 30) : layer.backdropOpacity,
      })),
    };
  });
  if (template.kind === 'video' && template.video) {
    try {
      const [video, poster] = await Promise.all([loadVideo(template.video), loadPoster(template.video)]);
      const metadata = TEMPLATE_VIDEO[template.video];
      const segmentSeconds = template.seconds;
      scenes = scenes.map((scene, index) => ({
        ...scene,
        image: video,
        mediaKind: 'video',
        videoPoster: poster,
        sourceDurationSeconds: metadata.duration,
        sourceInTicks: secondsToTicks(index * segmentSeconds, project.timebase),
        durationTicks: secondsToTicks(segmentSeconds, project.timebase),
        motion: 'none',
        transition: null,
      }));
    } catch {
      // Keep the bundled-photo fallback if a video file cannot be read.
    }
  }
  track.splice(0, track.length, ...scenes);
  normalizeStarts(track);
  if (template.audio) {
    try {
      const data = await loadAudio(template.audio);
      const metadata = TEMPLATE_AUDIO[template.audio];
      const total = track.reduce((end, scene) => end + scene.durationTicks, 0);
      const duration = Math.min(total, secondsToTicks(metadata.duration, project.timebase));
      if (duration > 0) {
        project.audio = [{
          id: `template-audio-${crypto.randomUUID()}`,
          name: metadata.title,
          data,
          lane: 0,
          startTicks: 0,
          durationTicks: duration,
          sourceInSeconds: 0,
          sourceDurationSeconds: metadata.duration,
          volume: template.audioVolume ?? .48,
          fadeIn: .8,
          fadeOut: 1.2,
        }];
      }
    } catch {
      // A missing score leaves a silent template instead of breaking creation.
    }
  }
  return project;
}
