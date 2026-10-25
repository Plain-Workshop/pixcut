export interface Template {
  id: string;
  name: string;
  category: string;
  format: string;
  duration: number;
  popularity: number;
  languages: string[];
  image: string;
  scenes: number;
  editable: string[];
  media: string;
  license: string;
  version: string;
  description: string;
}

export const templates: Template[] = [
  {
    id: 'travel-reel',
    name: 'Travel Memories',
    category: 'Travel',
    format: '16:9',
    duration: 30,
    popularity: 94,
    languages: ['EN'],
    image: '/images/travel.jpg',
    scenes: 12,
    editable: ['Title', 'Location', 'Music', 'Photo order'],
    media: '8–12 photos or clips, 1920×1080 or larger',
    license: 'CC-BY 4.0',
    version: '1.2.0',
    description: 'A cinematic travel recap with location pins, gentle Ken Burns motion and a beat-matched soundtrack.',
  },
  {
    id: 'social-story',
    name: 'Daily Vlog',
    category: 'Social',
    format: '9:16',
    duration: 40,
    popularity: 91,
    languages: ['EN'],
    image: '/images/vlog.jpg',
    scenes: 8,
    editable: ['Title', 'Captions', 'Music', 'Stickers'],
    media: '6–10 vertical clips, 1080×1920',
    license: 'CC-BY 4.0',
    version: '1.1.3',
    description: 'A fast vertical story for Shorts, Reels and TikTok with animated captions and safe-area guides.',
  },
  {
    id: 'brand-kit',
    name: 'Product Showcase',
    category: 'Business',
    format: '4:5',
    duration: 12,
    popularity: 86,
    languages: ['EN'],
    image: '/images/product.jpg',
    scenes: 6,
    editable: ['Logo', 'Brand colors', 'Headline', 'Price card'],
    media: '4–6 product photos or clips, transparent PNG logo',
    license: 'CC BY 4.0',
    version: '2.0.1',
    description: 'A clean product spot with logo placement, brand color slots and a price card for social campaigns.',
  },
  {
    id: 'birthday-pop',
    name: 'Birthday Party',
    category: 'Birthday',
    format: '1:1',
    duration: 15,
    popularity: 78,
    languages: ['EN'],
    image: '/images/birthday.jpg',
    scenes: 7,
    editable: ['Name', 'Age', 'Photos', 'Party colors'],
    media: '5–8 photos, square crop recommended',
    license: 'CC-BY 4.0',
    version: '1.0.4',
    description: 'A playful birthday collage with confetti, bold numbers and a cheerful color palette.',
  },
  {
    id: 'family-moments',
    name: 'Family Moments',
    category: 'Family',
    format: '16:9',
    duration: 20,
    popularity: 83,
    languages: ['EN'],
    image: '/images/family.jpg',
    scenes: 9,
    editable: ['Title', 'Names', 'Photos', 'Music'],
    media: '6–10 photos, any orientation',
    license: 'CC-BY 4.0',
    version: '1.3.0',
    description: 'A warm family slideshow with soft transitions, handwritten captions and room for names.',
  },
  {
    id: 'wedding-film',
    name: 'Wedding',
    category: 'Wedding',
    format: '16:9',
    duration: 45,
    popularity: 89,
    languages: ['EN'],
    image: '/images/wedding.jpg',
    scenes: 14,
    editable: ['Names', 'Date', 'Venue', 'Vows', 'Music'],
    media: '12–20 photos or clips, mixed orientation',
    license: 'CC BY 4.0',
    version: '2.1.0',
    description: 'An elegant wedding film with title cards, soft film grain and a long-form music bed.',
  },
  {
    id: 'holiday-glow',
    name: 'Holiday Season',
    category: 'Holiday',
    format: '1:1',
    duration: 18,
    popularity: 72,
    languages: ['EN'],
    image: '/images/holiday.jpg',
    scenes: 6,
    editable: ['Greeting', 'Names', 'Photos', 'Light effects'],
    media: '4–8 photos, warm or low-light images',
    license: 'CC-BY 4.0',
    version: '1.0.2',
    description: 'A cozy holiday greeting with bokeh lights, a short message and a warm color grade.',
  },
  {
    id: 'city-promo',
    name: 'Business Promo',
    category: 'Business',
    format: '16:9',
    duration: 25,
    popularity: 81,
    languages: ['EN'],
    image: '/images/business.jpg',
    scenes: 10,
    editable: ['Company name', 'Tagline', 'Services', 'Logo', 'CTA'],
    media: '8–12 city or team clips, logo file',
    license: 'CC BY 4.0',
    version: '1.4.0',
    description: 'A confident business promo with kinetic type, service cards and a clear call to action.',
  },
];

export const categories = ['All', 'Travel', 'Family', 'Birthday', 'Business', 'Social', 'Wedding', 'Holiday'];
