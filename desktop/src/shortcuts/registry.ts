export type ShortcutPlatform = 'macos' | 'windows' | 'linux';
export type ShortcutContext = 'global' | 'editor' | 'timeline';
export type ShortcutCategory = 'Essential' | 'Playback' | 'Editing' | 'Timeline' | 'View' | 'File' | 'Export';
export type PresetId = 'pixcut' | 'premiere' | 'resolve' | 'custom';

export interface CommandDefinition {
  id: string;
  label: string;
  description: string;
  category: ShortcutCategory;
  context: ShortcutContext;
  synonyms: string[];
  defaultMac: string;
  defaultOther: string;
}

export interface ShortcutSettings {
  schema_version: 1;
  preset: PresetId;
  bindings: Record<string, string>;
}

export interface ShortcutConflict {
  binding: string;
  commandId: string;
  otherId: string;
}

export interface CommandAvailability {
  disabled: boolean;
  reason?: string;
}

const DEFINITIONS: CommandDefinition[] = [
  {
    id: 'palette.open',
    label: 'Command palette',
    description: 'Search every available PixCut command.',
    category: 'Essential',
    context: 'global',
    synonyms: ['search', 'commands', 'actions'],
    defaultMac: 'Mod+K',
    defaultOther: 'Mod+K',
  },
  {
    id: 'help.shortcuts',
    label: 'Keyboard shortcuts',
    description: 'Open the searchable shortcut reference.',
    category: 'Essential',
    context: 'global',
    synonyms: ['help', 'keys', 'bindings', 'reference'],
    defaultMac: '?',
    defaultOther: '?',
  },
  {
    id: 'settings.open',
    label: 'Open settings',
    description: 'Open PixCut settings.',
    category: 'Essential',
    context: 'global',
    synonyms: ['preferences', 'options', 'configuration'],
    defaultMac: 'Mod+,',
    defaultOther: 'Mod+,',
  },
  {
    id: 'project.new',
    label: 'New project',
    description: 'Start a new story or replace the current recovery project.',
    category: 'File',
    context: 'global',
    synonyms: ['create', 'blank', 'story'],
    defaultMac: 'Mod+N',
    defaultOther: 'Mod+N',
  },
  {
    id: 'project.open',
    label: 'Open project',
    description: 'Open a saved PixCut project from this device.',
    category: 'File',
    context: 'global',
    synonyms: ['load', 'file'],
    defaultMac: 'Mod+O',
    defaultOther: 'Mod+O',
  },
  {
    id: 'project.save',
    label: 'Save project',
    description: 'Save a portable project file with embedded media.',
    category: 'File',
    context: 'global',
    synonyms: ['export project', 'store'],
    defaultMac: 'Mod+S',
    defaultOther: 'Mod+S',
  },
  {
    id: 'project.import',
    label: 'Import media',
    description: 'Import JPEG, PNG, or WebP images into the current story.',
    category: 'File',
    context: 'global',
    synonyms: ['add photos', 'media', 'images'],
    defaultMac: 'Mod+I',
    defaultOther: 'Mod+I',
  },
  {
    id: 'export.open',
    label: 'Export video',
    description: 'Open the MP4 export dialog.',
    category: 'Export',
    context: 'global',
    synonyms: ['render', 'movie', 'mp4', 'share'],
    defaultMac: 'Mod+Shift+E',
    defaultOther: 'Mod+Shift+E',
  },
  {
    id: 'history.undo',
    label: 'Undo',
    description: 'Undo the last project edit.',
    category: 'Editing',
    context: 'editor',
    synonyms: ['revert', 'back'],
    defaultMac: 'Mod+Z',
    defaultOther: 'Mod+Z',
  },
  {
    id: 'history.redo',
    label: 'Redo',
    description: 'Restore the last undone edit.',
    category: 'Editing',
    context: 'editor',
    synonyms: ['forward', 'repeat'],
    defaultMac: 'Mod+Shift+Z',
    defaultOther: 'Mod+Shift+Z',
  },
  {
    id: 'playback.toggle',
    label: 'Play / pause',
    description: 'Play or pause the active story.',
    category: 'Playback',
    context: 'editor',
    synonyms: ['space', 'preview', 'start', 'stop'],
    defaultMac: 'Space',
    defaultOther: 'Space',
  },
  {
    id: 'playback.reverse',
    label: 'Play backward',
    description: 'Play the story backward from the playhead.',
    category: 'Playback',
    context: 'editor',
    synonyms: ['reverse', 'j', 'shuttle'],
    defaultMac: 'J',
    defaultOther: 'J',
  },
  {
    id: 'playback.stop',
    label: 'Stop playback',
    description: 'Stop playback and keep the playhead in place.',
    category: 'Playback',
    context: 'editor',
    synonyms: ['pause', 'k', 'halt'],
    defaultMac: 'K',
    defaultOther: 'K',
  },
  {
    id: 'playback.forward',
    label: 'Play forward',
    description: 'Play the story forward from the playhead.',
    category: 'Playback',
    context: 'editor',
    synonyms: ['play', 'l', 'shuttle'],
    defaultMac: 'L',
    defaultOther: 'L',
  },
  {
    id: 'clip.split',
    label: 'Split clip',
    description: 'Split the selected scene at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['cut', 'blade', 'divide'],
    defaultMac: 'Mod+B',
    defaultOther: 'Mod+B',
  },
  {
    id: 'clip.delete',
    label: 'Delete clip',
    description: 'Remove the selected clip. On audio, element and picture-in-picture lanes the gap stays.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['remove', 'trash'],
    defaultMac: 'Backspace',
    defaultOther: 'Delete',
  },
  {
    id: 'clip.ripple_delete',
    label: 'Ripple delete clip',
    description: 'Remove the selected clip and move later clips on the same lane earlier. Visual clips always close the gap.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['remove', 'shift delete'],
    defaultMac: 'Shift+Backspace',
    defaultOther: 'Shift+Delete',
  },
  {
    id: 'clip.duplicate',
    label: 'Duplicate clip',
    description: 'Add a copy of the selected scene after it.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['copy', 'clone'],
    defaultMac: 'Mod+D',
    defaultOther: 'Mod+D',
  },
  {
    id: 'timeline.prev_frame',
    label: 'Previous frame',
    description: 'Move the playhead back one frame.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['step', 'scrub'],
    defaultMac: 'ArrowLeft',
    defaultOther: 'ArrowLeft',
  },
  {
    id: 'timeline.next_frame',
    label: 'Next frame',
    description: 'Move the playhead forward one frame.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['step', 'scrub'],
    defaultMac: 'ArrowRight',
    defaultOther: 'ArrowRight',
  },
  {
    id: 'timeline.prev_edit',
    label: 'Previous edit point',
    description: 'Jump the playhead to the previous clip boundary on any track.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['cut', 'boundary', 'previous clip', 'edge'],
    defaultMac: 'ArrowUp',
    defaultOther: 'ArrowUp',
  },
  {
    id: 'timeline.next_edit',
    label: 'Next edit point',
    description: 'Jump the playhead to the next clip boundary on any track.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['cut', 'boundary', 'next clip', 'edge'],
    defaultMac: 'ArrowDown',
    defaultOther: 'ArrowDown',
  },
  {
    id: 'timeline.back_second',
    label: 'Back one second',
    description: 'Move the playhead back one second.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['rewind', 'jump'],
    defaultMac: 'Shift+ArrowLeft',
    defaultOther: 'Shift+ArrowLeft',
  },
  {
    id: 'timeline.forward_second',
    label: 'Forward one second',
    description: 'Move the playhead forward one second.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['skip', 'jump'],
    defaultMac: 'Shift+ArrowRight',
    defaultOther: 'Shift+ArrowRight',
  },
  {
    id: 'timeline.go_start',
    label: 'Go to start',
    description: 'Move the playhead to the start of the story.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['beginning', 'home', 'first frame'],
    defaultMac: 'Home',
    defaultOther: 'Home',
  },
  {
    id: 'timeline.go_end',
    label: 'Go to end',
    description: 'Move the playhead to the last frame of the story.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['finish', 'last frame'],
    defaultMac: 'End',
    defaultOther: 'End',
  },
  {
    id: 'timeline.zoom_in',
    label: 'Zoom in timeline',
    description: 'Zoom the timeline in around the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['magnify', 'closer'],
    defaultMac: '=',
    defaultOther: '=',
  },
  {
    id: 'timeline.zoom_out',
    label: 'Zoom out timeline',
    description: 'Zoom the timeline out around the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['shrink', 'overview'],
    defaultMac: '-',
    defaultOther: '-',
  },
  {
    id: 'timeline.zoom_fit',
    label: 'Fit timeline',
    description: 'Fit the whole story in the timeline.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['overview', 'reset zoom', 'whole'],
    defaultMac: 'Shift+Z',
    defaultOther: 'Shift+Z',
  },
  {
    id: 'timeline.snapping',
    label: 'Toggle snapping',
    description: 'Snap the playhead to scene boundaries while scrubbing.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['magnet', 'align'],
    defaultMac: 'N',
    defaultOther: 'N',
  },
  {
    id: 'edit.select_all',
    label: 'Select all clips',
    description: 'Select every scene on the timeline.',
    category: 'Editing',
    context: 'editor',
    synonyms: ['selection', 'everything', 'all'],
    defaultMac: 'Mod+A',
    defaultOther: 'Mod+A',
  },
  {
    id: 'clip.trim_start',
    label: 'Trim start to playhead',
    description: 'Cut the selected clip so it starts at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['cut in','shorten','head'],
    defaultMac: 'Q',
    defaultOther: 'Q',
  },
  {
    id: 'clip.trim_end',
    label: 'Trim end to playhead',
    description: 'Cut the selected clip so it ends at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['cut out','shorten','tail'],
    defaultMac: 'W',
    defaultOther: 'W',
  },
  {
    id: 'clip.nudge_left',
    label: 'Nudge clip earlier',
    description: 'Move the selected audio, element or picture-in-picture clip one frame earlier.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['move','frame','shift left'],
    defaultMac: 'Alt+ArrowLeft',
    defaultOther: 'Alt+ArrowLeft',
  },
  {
    id: 'clip.nudge_right',
    label: 'Nudge clip later',
    description: 'Move the selected audio, element or picture-in-picture clip one frame later.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['move','frame','shift right'],
    defaultMac: 'Alt+ArrowRight',
    defaultOther: 'Alt+ArrowRight',
  },
  {
    id: 'clip.nudge_left_10',
    label: 'Nudge clip 10 frames earlier',
    description: 'Move the selected clip ten frames earlier.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['move','frames','shift left'],
    defaultMac: 'Alt+Shift+ArrowLeft',
    defaultOther: 'Alt+Shift+ArrowLeft',
  },
  {
    id: 'clip.nudge_right_10',
    label: 'Nudge clip 10 frames later',
    description: 'Move the selected clip ten frames later.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['move','frames','shift right'],
    defaultMac: 'Alt+Shift+ArrowRight',
    defaultOther: 'Alt+Shift+ArrowRight',
  },
  {
    id: 'clip.copy',
    label: 'Copy clip',
    description: 'Copy the selected clip.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['duplicate','clipboard'],
    defaultMac: 'Mod+C',
    defaultOther: 'Mod+C',
  },
  {
    id: 'clip.paste',
    label: 'Paste clip',
    description: 'Paste the copied clip at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['duplicate','clipboard'],
    defaultMac: 'Mod+V',
    defaultOther: 'Mod+V',
  },
  {
    id: 'edit.select_after',
    label: 'Select clips after playhead',
    description: 'Select every visual clip that starts at or after the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['rest','following','ripple'],
    defaultMac: 'Mod+Shift+ArrowRight',
    defaultOther: 'Mod+Shift+ArrowRight',
  },
  {
    id: 'edit.deselect',
    label: 'Clear selection',
    description: 'Deselect clips, text layers and overlays.',
    category: 'Editing',
    context: 'editor',
    synonyms: ['none', 'clear', 'deselect'],
    defaultMac: 'Escape',
    defaultOther: 'Escape',
  },
  {
    id: 'beat.add',
    label: 'Add beat marker',
    description: 'Place a beat marker at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['marker', 'beat', 'pulse'],
    defaultMac: 'B',
    defaultOther: 'B',
  },
  {
    id: 'text.add',
    label: 'Add text layer',
    description: 'Add a text layer at the playhead.',
    category: 'Timeline',
    context: 'timeline',
    synonyms: ['title', 'caption', 'type'],
    defaultMac: 'T',
    defaultOther: 'T',
  },
  {
    id: 'view.safe_area',
    label: 'Toggle safe area',
    description: 'Show or hide social safe-area guides in the preview.',
    category: 'View',
    context: 'editor',
    synonyms: ['guides', 'safe zone'],
    defaultMac: 'Shift+S',
    defaultOther: 'Shift+S',
  },
];

export const COMMANDS = DEFINITIONS;
export const COMMAND_BY_ID = new Map(DEFINITIONS.map(command => [command.id, command]));
export const COMMAND_IDS = DEFINITIONS.map(command => command.id);
export const CATEGORY_ORDER: ShortcutCategory[] = ['Essential', 'Playback', 'Editing', 'Timeline', 'View', 'File', 'Export'];
export const PRESET_LABELS: Record<PresetId, string> = {
  pixcut: 'PixCut Default',
  premiere: 'Premiere-style',
  resolve: 'Resolve-style',
  custom: 'Custom',
};

const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Alt', 'Shift', 'Meta'] as const;
const MODIFIER_ALIASES: Record<string, typeof MODIFIER_ORDER[number]> = {
  mod: 'Mod',
  primary: 'Mod',
  cmd: 'Mod',
  command: 'Mod',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  option: 'Alt',
  opt: 'Alt',
  shift: 'Shift',
  meta: 'Meta',
  super: 'Meta',
};
const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  space: 'Space',
  spacebar: 'Space',
  esc: 'Escape',
  escape: 'Escape',
  del: 'Delete',
  delete: 'Delete',
  backspace: 'Backspace',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  return: 'Enter',
  enter: 'Enter',
  tab: 'Tab',
  plus: 'Plus',
  '+': 'Plus',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
};
const NON_RECORDING_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock', 'Dead', 'Unidentified', 'Process']);
const STORAGE_KEY = 'pixcut-shortcuts';
const STORAGE_VERSION = 1;

export function detectPlatform(): ShortcutPlatform {
  if (typeof navigator === 'undefined') return 'linux';
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (value.includes('mac')) return 'macos';
  if (value.includes('win')) return 'windows';
  return 'linux';
}

export function contextLabel(context: ShortcutContext) {
  return context === 'global' ? 'Global' : context === 'editor' ? 'Editor' : 'Timeline';
}

export function defaultBindingFor(id: string, platform = detectPlatform()) {
  const command = COMMAND_BY_ID.get(id);
  if (!command) return '';
  return platform === 'macos' ? command.defaultMac : command.defaultOther;
}

export function defaultBindings(platform = detectPlatform()) {
  return Object.fromEntries(COMMANDS.map(command => [command.id, defaultBindingFor(command.id, platform)]));
}

export function defaultShortcutSettings(platform = detectPlatform()): ShortcutSettings {
  return { schema_version: STORAGE_VERSION, preset: 'pixcut', bindings: defaultBindings(platform) };
}

const PRESET_OVERRIDES: Record<Exclude<PresetId, 'custom'>, Record<string, string>> = {
  pixcut: {},
  premiere: {
    'clip.split': 'C',
    'clip.duplicate': 'Mod+Shift+D',
    'timeline.snapping': 'S',
    'help.shortcuts': 'F1',
  },
  resolve: {
    'clip.split': 'Mod+B',
    'clip.duplicate': 'Mod+D',
    'timeline.snapping': 'N',
    'help.shortcuts': 'F1',
  },
};

export function presetSettings(preset: Exclude<PresetId, 'custom'>, platform = detectPlatform()): ShortcutSettings {
  return {
    schema_version: STORAGE_VERSION,
    preset,
    bindings: { ...defaultBindings(platform), ...PRESET_OVERRIDES[preset] },
  };
}

function normalizeKeyToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const alias = KEY_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;
  if (trimmed.length === 1) return /[a-z]/i.test(trimmed) ? trimmed.toUpperCase() : trimmed;
  if (/^(f\d{1,2})$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
}

export function parseBinding(binding: string): { mods: Set<string>; key: string } | null {
  if (!binding.trim()) return null;
  const parts = binding.split('+');
  if (parts.some(part => !part.trim())) return null;
  const key = normalizeKeyToken(parts.at(-1) ?? '');
  if (!key) return null;
  const mods = new Set<string>();
  for (const part of parts.slice(0, -1)) {
    const mod = MODIFIER_ALIASES[part.trim().toLowerCase()];
    if (!mod) return null;
    mods.add(mod);
  }
  return { mods, key };
}

export function canonicalizeBinding(binding: string) {
  const parsed = parseBinding(binding);
  if (!parsed) return null;
  return [...MODIFIER_ORDER.filter(mod => parsed.mods.has(mod)), parsed.key].join('+');
}

const RESERVED_BINDINGS: Record<ShortcutPlatform, string[]> = {
  macos: ['Mod+Q', 'Mod+W', 'Mod+H', 'Mod+Tab', 'Mod+Space', 'Mod+Alt+Escape'],
  windows: ['Alt+Tab', 'Alt+F4', 'Meta+Tab', 'Ctrl+Escape', 'Ctrl+Alt+Delete'],
  linux: ['Alt+Tab', 'Alt+F4', 'Meta+Tab', 'Ctrl+Alt+Delete'],
};

export function isReservedBinding(binding: string, platform = detectPlatform()) {
  const canonical = canonicalizeBinding(binding);
  if (!canonical) return false;
  return RESERVED_BINDINGS[platform].some(item => canonicalizeBinding(item) === canonical);
}

function keyFromEvent(event: KeyboardEvent) {
  if (event.code === 'Space') return 'Space';
  const alias = KEY_ALIASES[event.key.toLowerCase()];
  if (alias) return alias;
  if (event.key.length === 1) return /[a-z]/i.test(event.key) ? event.key.toUpperCase() : event.key;
  if (/^F\d{1,2}$/i.test(event.key)) return event.key.toUpperCase();
  return null;
}

function isShiftedPunctuation(key: string) {
  return key === 'Plus' || (key.length === 1 && !/[a-z0-9]/i.test(key));
}

export function bindingFromEvent(event: KeyboardEvent, platform = detectPlatform()): string | null {
  if (event.isComposing || NON_RECORDING_KEYS.has(event.key)) return null;
  const key = keyFromEvent(event);
  if (!key) return null;
  const mods: string[] = [];
  if (platform === 'macos') {
    if (event.metaKey) mods.push('Mod');
    if (event.ctrlKey) mods.push('Ctrl');
  } else {
    if (event.ctrlKey) mods.push('Mod');
    if (event.metaKey) mods.push('Meta');
  }
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey && !isShiftedPunctuation(key)) mods.push('Shift');
  return [...MODIFIER_ORDER.filter(mod => mods.includes(mod)), key].join('+');
}

export function bindingMatchesEvent(binding: string, event: KeyboardEvent, platform = detectPlatform()) {
  if (isReservedBinding(binding, platform)) return false;
  const parsed = parseBinding(binding);
  if (!parsed || event.isComposing || NON_RECORDING_KEYS.has(event.key)) return false;
  if (keyFromEvent(event) !== parsed.key) return false;
  const primary = platform === 'macos' ? event.metaKey : event.ctrlKey;
  if (parsed.mods.has('Mod') !== primary) return false;
  if (parsed.mods.has('Ctrl') !== event.ctrlKey) return false;
  if (parsed.mods.has('Alt') !== event.altKey) return false;
  // On macOS the Command key is both the primary modifier (Mod) and the Meta key,
  // so an explicit Mod already accounts for a pressed metaKey.
  const metaAccountedByMod = platform === 'macos' && parsed.mods.has('Mod');
  if (parsed.mods.has('Meta') !== (event.metaKey && !metaAccountedByMod)) return false;
  const shiftMatters = !isShiftedPunctuation(parsed.key);
  if (shiftMatters && parsed.mods.has('Shift') !== event.shiftKey) return false;
  return true;
}

export function bindingHasPrimaryModifier(binding: string) {
  const parsed = parseBinding(binding);
  return Boolean(parsed && (parsed.mods.has('Mod') || parsed.mods.has('Ctrl') || parsed.mods.has('Alt') || parsed.mods.has('Meta')));
}

export function formatBinding(binding: string, platform = detectPlatform()) {
  const parsed = parseBinding(binding);
  if (!parsed) return 'Unassigned';
  const keyLabels: Record<string, string> = {
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Escape: 'Esc',
    Delete: 'Del',
    Backspace: '⌫',
    Enter: '↩',
    Plus: '+',
  };
  const key = keyLabels[parsed.key] ?? parsed.key;
  if (platform === 'macos') {
    const macMods: Record<string, string> = { Mod: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Meta: '⌘' };
    return [...MODIFIER_ORDER.filter(mod => parsed.mods.has(mod)).map(mod => macMods[mod]), key].join('');
  }
  const otherMods: Record<string, string> = { Mod: 'Ctrl', Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Meta: 'Win' };
  return [...MODIFIER_ORDER.filter(mod => parsed.mods.has(mod)).map(mod => otherMods[mod]), key].join('+');
}

export function contextsOverlap(a: ShortcutContext, b: ShortcutContext) {
  if (a === b) return true;
  if (a === 'global' || b === 'global') return true;
  return a === 'editor' || b === 'editor';
}

export function findConflicts(bindings: Record<string, string>): ShortcutConflict[] {
  const conflicts: ShortcutConflict[] = [];
  const commands = COMMANDS.filter(command => bindings[command.id]);
  for (let i = 0; i < commands.length; i += 1) {
    for (let j = i + 1; j < commands.length; j += 1) {
      const a = commands[i], b = commands[j];
      if (canonicalizeBinding(bindings[a.id]) !== canonicalizeBinding(bindings[b.id])) continue;
      if (!contextsOverlap(a.context, b.context)) continue;
      conflicts.push({ binding: bindings[a.id], commandId: a.id, otherId: b.id });
    }
  }
  return conflicts;
}

export function conflictsFor(bindings: Record<string, string>, commandId: string, binding: string) {
  const canonical = canonicalizeBinding(binding);
  if (!canonical) return [];
  const source = COMMAND_BY_ID.get(commandId);
  if (!source) return [];
  return COMMANDS.filter(command => command.id !== commandId && canonicalizeBinding(bindings[command.id] ?? '') === canonical && contextsOverlap(source.context, command.context));
}

export function loadShortcutSettings(platform = detectPlatform()): ShortcutSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultShortcutSettings(platform);
    const parsed = parseShortcutSettings(JSON.parse(raw), platform, false);
    return parsed.settings ?? defaultShortcutSettings(platform);
  } catch {
    return defaultShortcutSettings(platform);
  }
}

export function saveShortcutSettings(settings: ShortcutSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function parseShortcutSettings(value: unknown, platform = detectPlatform(), strict = true): { settings?: ShortcutSettings; error?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { error: 'Shortcut settings must be a JSON object.' };
  const raw = value as Record<string, unknown>;
  if (raw.schema_version !== STORAGE_VERSION) return { error: 'Unsupported shortcut settings version.' };
  const preset = typeof raw.preset === 'string' && ['pixcut', 'premiere', 'resolve', 'custom'].includes(raw.preset) ? raw.preset as PresetId : 'custom';
  if (!raw.bindings || typeof raw.bindings !== 'object' || Array.isArray(raw.bindings)) return { error: 'Shortcut bindings must be an object.' };
  const source = raw.bindings as Record<string, unknown>;
  const bindings = defaultBindings(platform);
  for (const key of Object.keys(source)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) return { error: 'Shortcut settings contain a reserved key.' };
    if (!COMMAND_BY_ID.has(key)) {
      if (strict) return { error: `Unknown command: ${key}` };
      continue;
    }
    const binding = source[key];
    if (binding === '') { bindings[key] = ''; continue; }
    if (typeof binding !== 'string') return { error: `${key} must be a shortcut string.` };
    const canonical = canonicalizeBinding(binding);
    if (!canonical) return { error: `${key} contains an unsupported key combination.` };
    if (isReservedBinding(canonical, platform)) return { error: `${formatBinding(canonical, platform)} is reserved by the operating system.` };
    bindings[key] = canonical;
  }
  // A command added after these settings were saved (or exported) must not
  // take a key the user already chose; it starts unassigned instead.
  for (const conflict of findConflicts(bindings)) {
    const [added] = [conflict.commandId, conflict.otherId].filter(id => !(id in source));
    if (added) bindings[added] = '';
  }
  const settings: ShortcutSettings = { schema_version: STORAGE_VERSION, preset, bindings };
  const conflicts = findConflicts(bindings);
  if (conflicts.length) {
    const first = conflicts[0];
    return { error: `${formatBinding(first.binding, platform)} is assigned to both ${COMMAND_BY_ID.get(first.commandId)?.label} and ${COMMAND_BY_ID.get(first.otherId)?.label}.` };
  }
  return { settings };
}

export function shortcutReference(settings: ShortcutSettings, platform = detectPlatform()) {
  const lines = ['PixCut keyboard reference', `Generated ${new Date().toLocaleDateString()} · ${PRESET_LABELS[settings.preset]}`, ''];
  for (const category of CATEGORY_ORDER) {
    const commands = COMMANDS.filter(command => command.category === category);
    if (!commands.length) continue;
    lines.push(category.toUpperCase());
    for (const command of commands) {
      lines.push(`${formatBinding(settings.bindings[command.id] ?? '', platform).padEnd(16)} ${command.label} — ${command.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
}

export function isMacPlatform(platform: ShortcutPlatform) {
  return platform === 'macos';
}
