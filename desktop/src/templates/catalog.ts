import { ELEMENT_CATALOG } from '../components/elements/catalog';
import { presetSize } from '../components/elements/designer';
import { defaultFormat, emptyProject, normalizeStarts, projectScenes, secondsToTicks, type FilterId, type Project, type Scene, type TextLayer } from '../stores/model';
import { bundledPhotoDataUrl, templatePhotoDataUrl, templatePhotoUrl, FALLBACK_PHOTO_FILE, type TemplatePhotoId } from './photos';
import { TEMPLATE_AUDIO, TEMPLATE_VIDEO, templateAudioDataUrl, templateVideoDataUrl, templateVideoPosterDataUrl, templateVideoPosterUrl, type TemplateAudioId, type TemplateVideoId } from './media';
import { createTextLayer } from '../components/text/layers';
import { MUSIC_TRACKS, musicTrackClipName, musicTrackData } from '../stores/music-library';

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
  /** A track from the bundled music library (CC BY 4.0, credited in the clip name). The generated `audio` bed is the fallback. */
  music?: string;
  /** Social elements from the element catalog, placed on one scene (0-2) or on all of them. */
  overlays?: { preset: string; scene: number | 'all'; x?: number; y?: number }[];
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
      backdropEnabled: spec.category !== 'Social' && Boolean(spec.backdrop), backdropOpacity: spec.backdrop ?? 0,
      backdropBlur: 26, backdropPadding: 26, backdropRadius: 18,
      shadowEnabled: true, shadowIntensity: 70, shadowBlur: 18, shadowOffsetY: 4,
      animation: 'slide-up', animationDuration: .7, ...patch,
    });
    const layers = [
      layer({ title }),
      layer({ title: spec.captions[index], y: .075, size: .019, font: 'space-grotesk', fontWeight: 500, letterSpacing: .006, backdropEnabled: false, shadowEnabled: false, animation: 'fade' }),
      layer({ title: `0${index + 1} / 03`, y: .9, size: .02, font: 'dm-sans', fontWeight: 400, backdropEnabled: false, shadowEnabled: false, animation: 'fade' }),
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
      elements: (spec.overlays ?? []).filter(item => item.scene === 'all' || item.scene === index).flatMap(item => {
        const preset = ELEMENT_CATALOG.find(p => p.id === item.preset);
        if (!preset) return [];
        const [aw, ah] = spec.aspect.split(':').map(Number);
        return [{ id: crypto.randomUUID(), kind: preset.kind, presetId: preset.id, label: preset.text, x: item.x ?? .5, y: item.y ?? .8, ...presetSize(preset, { width: aw * 100, height: ah * 100 }), rotation: 0, color: preset.color, opacity: 100, startTicks: 0, durationTicks, animation: preset.animation }];
      }),
    };
    return scene;
  });
}

const STORIES: StorySpec[] = [
  {
    id: 'wild-escape', name: 'Wild escape', category: 'Nature',
    music: 'aphelion', overlays: [{ preset: 'callouts-10', scene: 2, x: 0.5, y: 0.84 }],
    description: 'Bold condensed type over valleys, pines and river mist.',
    photos: ['nature-valley', 'nature-pines', 'nature-river'],
    titles: ['GO\nOUTSIDE.', 'BREATHE\nDEEP.', 'STAY\nWILD.'],
    captions: ['01 / THE TRAILHEAD', '02 / THE QUIET PART', '03 / THE WAY BACK'],
    aspect: '16:9', seconds: 4, font: 'bebas-neue', size: .19, lineHeight: .92, align: 'left', y: .5,
    backdrop: 22, motion: 'zoom-in', transition: 'fade', accent: '#E8FF6A',
  },
  {
    id: 'motion-opener', name: 'Motion opener', category: 'Social', kind: 'video', video: 'aurora-motion',
    overlays: [{ preset: 'buttons-motion-01', scene: 2, x: 0.5, y: 0.8 }],
    description: 'A six-second animated opener with generated music, built for titles over motion.',
    photos: ['nature-aurora', 'nature-mist', 'nature-ridge'],
    titles: ['MOVE\nWITH IT.', 'KEEP\nGOING.', 'ONE\nMORE.'],
    captions: ['A NEW CHAPTER', 'IN MOTION', 'OUT NOW'],
    aspect: '16:9', seconds: 2, font: 'bebas-neue', size: .2, lineHeight: .92, align: 'center', x: .1, y: .5, width: .8,
    backdrop: 18, transition: 'fade', accent: '#FFD166', audio: 'night-drive', audioVolume: .62,
  },
  {
    id: 'golden-hour', name: 'Golden hour', category: 'Nature',
    music: 'ephemera', overlays: [{ preset: 'stories-09', scene: 0, x: 0.5, y: 0.84 }],
    description: 'Warm serif titles for sunset, balloons and slow light.',
    photos: ['coast-sunset', 'sky-balloon', 'nature-ridge'],
    titles: ['Chase the light.', 'A little higher.', 'Stay for the colours.'],
    captions: ['GOLDEN HOUR', 'NO RUSH', 'LAST LIGHT'],
    aspect: '16:9', seconds: 4.2, font: 'playfair', italic: true, size: .092, align: 'center', x: .1, y: .58, width: .8,
    backdrop: 18, motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 40,
  },
  {
    id: 'mountain-air', name: 'Mountain air', category: 'Nature',
    music: 'aurora', overlays: [{ preset: 'callouts-05', scene: 0, x: 0.5, y: 0.84 }],
    description: 'Vertical lettering for peaks, cloud inversions and aurora.',
    photos: ['nature-peak', 'nature-mist', 'nature-aurora'],
    titles: ['ABOVE\nTHE CLOUDS', 'UP HERE,\nNOTHING RUSHES', 'NIGHT\nSKY'],
    captions: ['ALTITUDE', 'THIN AIR', 'AURORA'],
    aspect: '9:16', seconds: 3.6, font: 'archivo-black', size: .12, lineHeight: .98, y: .58, width: .84,
    backdrop: 26, motion: 'zoom-out', transition: 'slide-up', accent: '#FFFFFF',
  },
  {
    id: 'coastline', name: 'Coastline', category: 'Travel',
    music: 'solace', overlays: [{ preset: 'travel-05', scene: 0, x: 0.5, y: 0.84 }],
    description: 'Clean, quiet captions for waves, rocks and long beaches.',
    photos: ['coast-waves', 'coast-rocks', 'people-splash'],
    titles: ['Salt in the air.', 'Nowhere to be.', 'One more swim.'],
    captions: ['THE COAST', 'OFF SEASON', 'LAST DIP'],
    aspect: '16:9', seconds: 4, font: 'space-grotesk', weight: 500, size: .082, y: .62, width: .62,
    motion: 'pan-right', transition: 'fade', filter: 'cool', filterIntensity: 30,
  },
  {
    id: 'city-nights', name: 'City nights', category: 'Travel',
    music: 'electric-dreams', overlays: [{ preset: 'reactions-09', scene: 2, x: 0.5, y: 0.82 }],
    description: 'Night-market energy with tall condensed headlines.',
    photos: ['street-night', 'city-venice', 'fashion-car'],
    titles: ['AFTER\nDARK', 'STILL\nOPEN', 'CITY\nLIGHTS'],
    captions: ['22:40', 'LAST ORDERS', 'WALK HOME'],
    aspect: '9:16', seconds: 3.4, font: 'bebas-neue', size: .2, lineHeight: .92, y: .5,
    backdrop: 20, motion: 'ken-burns', transition: 'slide-up', accent: '#FF4D6D',
  },
  {
    id: 'weekend-away', name: 'Weekend away', category: 'Travel',
    music: 'tears-in-rain', overlays: [{ preset: 'travel-07', scene: 0, x: 0.5, y: 0.84 }],
    description: 'A four-by-five road-trip diary with understated captions.',
    photos: ['road-truck', 'people-snow', 'nature-river'],
    titles: ['Two tanks\nand a map.', 'Cold hands,\nfull camera.', 'Home by\nSunday.'],
    captions: ['FRIDAY', 'SATURDAY', 'SUNDAY'],
    aspect: '4:5', seconds: 3.8, font: 'dm-sans', weight: 600, size: .078, lineHeight: 1.12, y: .64,
    motion: 'pan-left', transition: 'fade', filter: 'film', filterIntensity: 35,
  },
  {
    id: 'everyday-moments', name: 'Everyday moments', category: 'Family',
    music: 'with-these-hands', overlays: [{ preset: 'stories-10', scene: 2, x: 0.5, y: 0.86 }],
    description: 'Handwritten notes over the small, ordinary bits.',
    photos: ['friends-boys', 'couple-cozy', 'people-window'],
    titles: ['Our kind of Sunday', 'The good little things', 'Keep this feeling'],
    captions: ['A NOTE TO REMEMBER', 'RIGHT HERE, TOGETHER', 'WITH LOVE, ALWAYS'],
    aspect: '4:5', seconds: 4.2, font: 'caveat', weight: 600, size: .125, lineHeight: 1.02, y: .66,
    backdrop: 18, transition: 'fade',
  },
  {
    id: 'best-friends', name: 'Best friends', category: 'Social',
    music: 'unrealness', overlays: [{ preset: 'buttons-motion-02', scene: 2, x: 0.5, y: 0.8 }],
    description: 'Loud, punchy type for group photos and loud nights.',
    photos: ['friends-girls', 'action-jump', 'food-brunch'],
    titles: ['GOOD\nPEOPLE.', 'SAME\nCHAOS.', 'AGAIN\nTOMORROW.'],
    captions: ['THE GROUP CHAT', 'NO PLANS, BEST NIGHT', 'SAME TIME NEXT WEEK'],
    aspect: '9:16', seconds: 3.2, font: 'archivo-black', size: .15, lineHeight: .96, y: .5,
    backdrop: 24, motion: 'zoom-in', transition: 'circle', accent: '#FFD166',
  },
  {
    id: 'birthday-reel', name: 'Birthday reel', category: 'Birthday',
    music: 'solecism', overlays: [{ preset: 'events-02', scene: 0, x: 0.5, y: 0.82 }, { preset: 'reactions-08', scene: 2, x: 0.5, y: 0.82 }],
    description: 'Big vertical type, confetti transitions, zero subtlety.',
    photos: ['action-jump', 'food-brunch', 'coffee-friends'],
    titles: ['YOUR\nDAY.', 'BIG\nWISHES.', 'MORE\nLIFE.'],
    captions: ['TURN IT UP', 'MAKE THEM COUNT', 'HERE’S TO YOU'],
    aspect: '9:16', seconds: 3.2, font: 'bebas-neue', size: .23, lineHeight: .9, align: 'center', x: .1, y: .46, width: .8,
    backdrop: 20, motion: 'zoom-out', transition: 'circle', accent: '#FFB3C7',
  },
  {
    id: 'cafe-diary', name: 'Café diary', category: 'Food',
    music: 'tears-in-rain', overlays: [{ preset: 'food-03', scene: 0, x: 0.5, y: 0.84 }, { preset: 'food-10', scene: 2, x: 0.5, y: 0.84 }],
    description: 'Slow serif captions for brunch, coffee and street food.',
    photos: ['coffee-friends', 'food-street', 'food-brunch'],
    titles: ['Slow mornings.', 'Eat where they eat.', 'One more cup.'],
    captions: ['CAFÉ DIARY', 'MARKET DAY', 'STAY A WHILE'],
    aspect: '1:1', seconds: 3.6, font: 'playfair', italic: true, size: .078, y: .6, width: .7,
    motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 45,
  },
  {
    id: 'portrait-study', name: 'Portrait study', category: 'People',
    music: 'in-this-moment', overlays: [{ preset: 'lower-thirds-09', scene: 0, x: 0.3, y: 0.84 }],
    description: 'Editorial framing and tracked-out labels for portraits.',
    photos: ['people-portrait', 'people-man', 'people-shore'],
    titles: ['STUDY 01', 'STUDY 02', 'STUDY 03'],
    captions: ['NATURAL LIGHT', 'BETWEEN TAKES', 'THE LONG WAY HOME'],
    aspect: '4:5', seconds: 3.6, font: 'space-grotesk', weight: 500, size: .062, letterSpacing: .012, y: .66, width: .8,
    motion: 'none', transition: 'fade', filter: 'noir', filterIntensity: 25, accent: '#FFFFFF',
  },
  {
    id: 'love-story', name: 'Love story', category: 'People',
    music: 'with-these-hands', overlays: [{ preset: 'events-10', scene: 2, x: 0.5, y: 0.84 }],
    description: 'Soft serif lines for couples, weddings and hand-in-hand walks.',
    photos: ['couple-beach', 'couple-sunset', 'hands-autumn'],
    titles: ['You, me,\ngolden light.', 'Still my\nfavourite person.', 'Hold on\na bit longer.'],
    captions: ['THE TWO OF US', 'NO REASON NEEDED', 'AND THEN SOME'],
    aspect: '9:16', seconds: 4, font: 'playfair', italic: true, size: .095, lineHeight: 1.08, align: 'center', x: .1, y: .6, width: .8,
    backdrop: 16, motion: 'ken-burns', transition: 'fade', filter: 'dream', filterIntensity: 30,
  },
  {
    id: 'wedding-day', name: 'Wedding day', category: 'People',
    music: 'in-this-moment', overlays: [{ preset: 'events-03', scene: 0, x: 0.5, y: 0.84 }],
    description: 'Quiet serif promises over the ceremony and the after-party.',
    photos: ['couple-wedding', 'couple-beach', 'hands-autumn'],
    titles: ['I do.', 'Just us, then.', 'Forever starts\non a Tuesday.'],
    captions: ['THE DAY', 'THE GOLDEN HOUR', 'THE REST OF IT'],
    aspect: '9:16', seconds: 4, font: 'playfair', size: .1, lineHeight: 1.06, align: 'center', x: .1, y: .62, width: .8,
    backdrop: 14, motion: 'zoom-in', transition: 'fade', filter: 'film', filterIntensity: 25,
  },
  {
    id: 'photo-dump', name: 'Photo dump', category: 'Social',
    description: 'Casual, lowercase carousel energy for the “no context” camera-roll posts.',
    photos: ['friends-girls', 'coffee-friends', 'street-night'],
    titles: ['photo\ndump.', 'random\nbits.', 'no\ncontext.'],
    captions: ['CAMERA ROLL', 'THIS WEEK', 'SWIPE →'],
    aspect: '9:16', seconds: 2.6, font: 'dm-sans', weight: 700, size: .13, lineHeight: .95, letterSpacing: -.01, y: .62, motion: 'zoom-in', transition: 'slide', filter: 'film', filterIntensity: 40,
    music: 'unrealness', overlays: [{ preset: 'callouts-10', scene: 2, x: 0.5, y: 0.82 }, { preset: 'creator-09', scene: 0, x: 0.5, y: 0.84 }],
  },
  {
    id: 'day-in-my-life', name: 'Day in my life', category: 'Social',
    description: 'A calm morning-to-night vlog structure with day markers.',
    photos: ['people-window', 'coffee-friends', 'street-night'],
    titles: ['morning,\nslowly.', 'coffee &\nfocus.', 'night\nwalk.'],
    captions: ['07:30', '13:00', '22:15'],
    aspect: '9:16', seconds: 3, font: 'inter', weight: 300, size: .1, lineHeight: 1.02, letterSpacing: -.015, y: .7, motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 25,
    music: 'solace', overlays: [{ preset: 'chapters-06', scene: 0, x: 0.28, y: 0.14 }, { preset: 'creator-02', scene: 2, x: 0.5, y: 0.82 }],
  },
  {
    id: 'year-wrapped', name: 'Year wrapped', category: 'Social',
    description: 'A bold end-of-year recap in the style of the “wrapped” stories.',
    photos: ['action-jump', 'coast-sunset', 'friends-boys'],
    titles: ['2026\nWRAPPED', 'TOP\nMOMENTS', 'SEE YOU\nIN 2027'],
    captions: ['YOUR YEAR IN PHOTOS', 'THE BEST BITS', 'THANKS FOR BEING HERE'],
    aspect: '9:16', seconds: 3, font: 'archivo-black', size: .13, lineHeight: .94, y: .56, backdrop: 24, motion: 'zoom-out', transition: 'circle', accent: '#B6FF5C',
    music: 'electric-dreams', overlays: [{ preset: 'data-10', scene: 1, x: 0.5, y: 0.84 }, { preset: 'end-screens-09', scene: 2, x: 0.5, y: 0.84 }],
  },
  {
    id: 'fit-check', name: 'Fit check', category: 'People',
    description: 'Punchy style-post titles with a link-in-bio call to action.',
    photos: ['fashion-car', 'people-beach', 'people-portrait'],
    titles: ['FIT\nCHECK.', 'ON\nREPEAT.', 'RATE\nIT.'],
    captions: ['TODAY’S LOOK', 'SAVE FOR LATER', 'TELL ME BELOW'],
    aspect: '9:16', seconds: 2.8, font: 'inter', weight: 800, size: .17, lineHeight: .92, letterSpacing: -.02, y: .56, backdrop: 14, motion: 'pan-right', transition: 'slide-up',
    music: 'funk-you', overlays: [{ preset: 'reactions-06', scene: 0, x: 0.5, y: 0.84 }, { preset: 'creator-09', scene: 2, x: 0.5, y: 0.84 }],
  },
  {
    id: 'trip-recap', name: 'Trip recap', category: 'Travel',
    description: 'A boarding-pass opener and serif itinerary for a trip in three stops.',
    photos: ['city-venice', 'coast-rocks', 'sky-balloon'],
    titles: ['Stop one:\nVenice', 'Stop two:\nthe coast', 'Stop three:\nthe sky'],
    captions: ['ITINERARY', 'DAY TWO', 'DAY THREE'],
    aspect: '9:16', seconds: 3.4, font: 'libre-baskerville', size: .085, lineHeight: 1.1, align: 'center', x: .1, y: .6, width: .8, backdrop: 16, motion: 'ken-burns', transition: 'fade', filter: 'cool', filterIntensity: 20,
    music: 'clear-skies', overlays: [{ preset: 'travel-01', scene: 0, x: 0.5, y: 0.84 }, { preset: 'travel-06', scene: 2, x: 0.5, y: 0.84 }],
  },
  {
    id: 'cozy-autumn', name: 'Cozy autumn', category: 'Family',
    description: 'Warm italic serif for knitwear, forest walks and slow weekends.',
    photos: ['couple-cozy', 'hands-autumn', 'nature-river'],
    titles: ['Sweater\nweather.', 'Golden\nwalks.', 'Home by\ncandlelight.'],
    captions: ['OCTOBER', 'THE LONG WAY', 'SUNDAY RESET'],
    aspect: '4:5', seconds: 3.6, font: 'libre-baskerville', italic: true, size: .075, lineHeight: 1.12, y: .62, backdrop: 18, motion: 'ken-burns', transition: 'fade', filter: 'warm', filterIntensity: 50,
    music: 'in-this-moment', overlays: [{ preset: 'stories-04', scene: 0, x: 0.5, y: 0.84 }, { preset: 'stories-08', scene: 2, x: 0.5, y: 0.84 }],
  },
  {
    id: 'new-drop', name: 'New drop', category: 'Social',
    description: 'A square product-launch post for small shops, with a limited-edition badge.',
    photos: ['food-street', 'coffee-friends', 'food-brunch'],
    titles: ['NEW\nDROP', 'FRESH\nTODAY', 'LIMITED\nRUN'],
    captions: ['OUT NOW', 'HANDMADE', 'WHILE IT LASTS'],
    aspect: '1:1', seconds: 2.8, font: 'space-grotesk', weight: 700, size: .16, lineHeight: .92, align: 'center', x: .1, y: .5, width: .8, backdrop: 22, motion: 'zoom-in', transition: 'circle', accent: '#FFD166',
    music: 'cuban-crunch', overlays: [{ preset: 'badges-05', scene: 0, x: 0.5, y: 0.84 }, { preset: 'end-screens-08', scene: 2, x: 0.5, y: 0.84 }],
  },
  {
    id: 'soft-launch', name: 'Soft launch', category: 'Social',
    description: 'Quiet, airy captions for a “soft launch” of a trip, a person or a project.',
    photos: ['couple-sunset', 'coast-waves', 'people-shore'],
    titles: ['soft\nlaunch.', 'still\nprivate.', 'more\nsoon.'],
    captions: ['A LITTLE PREVIEW', 'NO CAPTION NEEDED', 'STAY TUNED'],
    aspect: '4:5', seconds: 3.2, font: 'playfair', weight: 400, size: .12, lineHeight: 1, align: 'center', x: .1, y: .58, width: .8, motion: 'zoom-out', transition: 'fade', filter: 'dream', filterIntensity: 35,
    music: 'origami', overlays: [{ preset: 'creator-02', scene: 2, x: 0.5, y: 0.84 }],
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
  loadMusic: (track: (typeof MUSIC_TRACKS)[number]) => Promise<string> = musicTrackData,
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
      elements: scene.elements?.map(element => ({ ...element, durationTicks })),
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
  const total = track.reduce((end, scene) => end + scene.durationTicks, 0);
  const musicTrack = MUSIC_TRACKS.find(item => item.id === template.music);
  if (musicTrack && total > 0) {
    try {
      const data = await loadMusic(musicTrack);
      project.audio = [{
        id: `template-audio-${crypto.randomUUID()}`, name: musicTrackClipName(musicTrack), data, lane: 0, startTicks: 0,
        durationTicks: Math.min(total, secondsToTicks(musicTrack.seconds, project.timebase)), sourceInSeconds: 0,
        sourceDurationSeconds: musicTrack.seconds, volume: template.audioVolume ?? .48, fadeIn: .8, fadeOut: 1.4,
      }];
    } catch {
      // Fall through to the bundled bed below.
    }
  }
  if (template.audio && !project.audio.length) {
    try {
      const data = await loadAudio(template.audio);
      const metadata = TEMPLATE_AUDIO[template.audio];
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
