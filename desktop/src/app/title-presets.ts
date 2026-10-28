import type { TextLayer } from '../stores/model';

export const TITLE_PRESETS: { id: string; name: string; sample: string; layer: Partial<TextLayer> }[] = [
  { id: 'plain', name: 'Simple', sample: 'Your title', layer: { title: 'Your title', subtitle: '', font: 'inter', size: .07, align: 'center', x: .12, y: .42, width: .76 } },
  { id: 'editorial', name: 'Editorial', sample: 'A little story', layer: { title: 'A little story', subtitle: '', font: 'playfair', size: .08, x: .08, y: .65, width: .8, animation: 'fade' } },
  { id: 'bold', name: 'Bold', sample: 'MAKE IT.', layer: { title: 'MAKE IT.', subtitle: '', font: 'archivo-black', size: .1, x: .08, y: .2, width: .8, animation: 'pop' } },
  { id: 'note', name: 'Handwritten', sample: 'Remember this', layer: { title: 'Remember this', subtitle: '', font: 'caveat', size: .1, x: .08, y: .7, width: .8 } },
  { id: 'lower', name: 'Lower third', sample: 'Your name', layer: { title: 'Your name', subtitle: 'A little about you', font: 'dm-sans', size: .045, x: .08, y: .76, width: .7, backdropEnabled: true, backdropOpacity: 60 } },
  { id: 'plain', name: 'Chapter', sample: '01 / A new chapter', layer: { title: '01 / A new chapter', subtitle: '', font: 'space-grotesk', size: .055, x: .08, y: .45, width: .84, animation: 'slide-up' } },
  { id: 'bold', name: 'Quote', sample: '“Make it happen.”', layer: { title: '“Make it happen.”', subtitle: 'YOUR NAME', font: 'playfair', size: .075, align: 'center', x: .1, y: .4, width: .8 } },
  { id: 'lower', name: 'Interview', sample: 'Alex Morgan', layer: { title: 'Alex Morgan', subtitle: 'Designer / Creator', font: 'inter', size: .05, x: .07, y: .72, width: .75, backdropEnabled: true, backdropOpacity: 70, animation: 'slide-up' } },
  { id: 'plain', name: 'Date & place', sample: 'Warsaw, October 2026', layer: { title: 'Warsaw, October 2026', subtitle: '', font: 'dm-sans', size: .035, x: .08, y: .1, width: .84 } },
  { id: 'bold', name: 'Call to action', sample: 'Discover more', layer: { title: 'Discover more', subtitle: 'YOUR WEBSITE', font: 'archivo-black', size: .065, align: 'center', x: .1, y: .42, width: .8, animation: 'pop' } },
  { id: 'caption', name: 'Credits', sample: 'Made by you', layer: { title: 'Made by you', subtitle: 'FILM • PHOTOGRAPHY • MUSIC', font: 'inter', size: .045, align: 'center', x: .1, y: .48, width: .8, animation: 'fade' } },
  { id: 'caption', name: 'Caption', sample: 'Say something.', layer: { title: 'Say something.', subtitle: '', font: 'inter', size: .035, align: 'center', x: .1, y: .84, width: .8, backdropEnabled: true, backdropOpacity: 65 } },
];
