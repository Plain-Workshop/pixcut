/**
 * Bundled template photography. Every file lives in `public/templates` and
 * ships with the app, so a template opens without a network request. All of
 * these are CC0 (public-domain dedication) photos, mostly Unsplash imports
 * archived on Wikimedia Commons; `public/templates/credits.json` keeps the
 * source page for each one.
 */
export type TemplatePhoto = {
  file: string;
  title: string;
  author: string;
  license: string;
  source: string;
};

export const TEMPLATE_PHOTOS = {
  'action-jump': { file: 'action-jump.jpg', title: "Happy Couple", author: "Freestocks.org", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Happy_Couple_(Unsplash).jpg" },
  'city-venice': { file: 'city-venice.jpg', title: "Venice Cityscape Sunset.", author: "Jonathan Pielmayer", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Venice_cityscape_sunset._(Unsplash).jpg" },
  'coast-rocks': { file: 'coast-rocks.jpg', title: "Rocky Ocean Lagoon", author: "Magnus Lindvall", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Rocky_ocean_lagoon_(Unsplash).jpg" },
  'coast-sunset': { file: 'coast-sunset.jpg', title: "Tranquil Red And Pink Sunset Over Water.", author: "Davide Ragusa", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Tranquil_red_and_pink_sunset_over_water._(Unsplash).jpg" },
  'coast-waves': { file: 'coast-waves.jpg', title: "Ocean And Waves", author: "Esther Cuan", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Ocean_and_waves_(Unsplash).jpg" },
  'coffee-friends': { file: 'coffee-friends.jpg', title: "Coffee And Friends", author: "Nathan Dumlao", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Coffee_and_Friends_(Unsplash).jpg" },
  'couple-beach': { file: 'couple-beach.jpg', title: "Couple In Paradise.", author: "Christopher Campbell", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Couple_in_Paradise._(Unsplash).jpg" },
  'couple-cozy': { file: 'couple-cozy.jpg', title: "Seated Couple Snuggling", author: "Priscilla Du Preez", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Seated_couple_snuggling_(Unsplash).jpg" },
  'couple-sunset': { file: 'couple-sunset.jpg', title: "Pink Sunset Couple", author: "Harli Marten", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Pink_sunset_couple_(Unsplash).jpg" },
  'couple-wedding': { file: 'couple-wedding.jpg', title: "Wedding Couple On A Footbridge", author: "Scott Webb", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Wedding_couple_on_a_footbridge_(Unsplash).jpg" },
  'fashion-car': { file: 'fashion-car.jpg', title: "Woman Shopping Car", author: "Freestocks.org", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Woman_shopping_car_(Unsplash).jpg" },
  'food-brunch': { file: 'food-brunch.jpg', title: "Brunching With Friends", author: "Ali Inay", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Brunching_with_Friends_(Unsplash).jpg" },
  'food-street': { file: 'food-street.jpg', title: "Asian Street Food Vendor", author: "James Sutton", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Asian_Street_Food_Vendor_(Unsplash).jpg" },
  'friends-boys': { file: 'friends-boys.jpg', title: "Good Old School Friends", author: "Aman Shrivastava", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Good_Old_School_Friends_(Unsplash).jpg" },
  'friends-girls': { file: 'friends-girls.jpg', title: "Photographer Friends", author: "Katie Treadway", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Photographer_Friends_(Unsplash).jpg" },
  'hands-autumn': { file: 'hands-autumn.jpg', title: "Lakeside Proposal", author: "Brooke Cagle", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Lakeside_Proposal_(Unsplash).jpg" },
  'nature-aurora': { file: 'nature-aurora.jpg', title: "Lofoten, Norway", author: "Johannes Groll", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Lofoten,_Norway_(Unsplash).jpg" },
  'nature-mist': { file: 'nature-mist.jpg', title: "Cloudy Mountains", author: "Palmer Krehel", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Cloudy_Mountains_(Unsplash).jpg" },
  'nature-peak': { file: 'nature-peak.jpg', title: "Matterhorn Sunset 2016", author: "Sam Ferrara", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Matterhorn_sunset_2016_(Unsplash).jpg" },
  'nature-pines': { file: 'nature-pines.jpg', title: "Fog Descending On A Pine Forest", author: "Pacific Austin", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Fog_descending_on_a_pine_forest_(Unsplash).jpg" },
  'nature-ridge': { file: 'nature-ridge.jpg', title: "Hazy Mountaintops At Dusk", author: "Fr\u00e9 Sonneveld", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Hazy_mountaintops_at_dusk_(Unsplash).jpg" },
  'nature-river': { file: 'nature-river.jpg', title: "Forest Snow In Sun", author: "Jaxon Stevens", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Forest_snow_in_sun_(Unsplash).jpg" },
  'nature-valley': { file: 'nature-valley.jpg', title: "Alone In The Unspoilt Wilderness", author: "David Marcu", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Alone_in_the_unspoilt_wilderness_(Unsplash).jpg" },
  'people-beach': { file: 'people-beach.jpg', title: "Woman Walking On A Sand Beach", author: "Nadia Jamnik", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Woman_walking_on_a_sand_beach_(Unsplash).jpg" },
  'people-man': { file: 'people-man.jpg', title: "Face Portrait", author: "William Stitt", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Face_portrait_(Unsplash).jpg" },
  'people-portrait': { file: 'people-portrait.jpg', title: "Portrait", author: "Alesia Kazantceva", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Portrait_(Unsplash).jpg" },
  'people-shore': { file: 'people-shore.jpg', title: "Woman On A Slope By The Shore", author: "Myles Tan", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Woman_on_a_slope_by_the_shore_(Unsplash).jpg" },
  'people-snow': { file: 'people-snow.jpg', title: "Woman In A Snowy Forest", author: "Cameron Kirby", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Woman_in_a_snowy_forest_(Unsplash).jpg" },
  'people-splash': { file: 'people-splash.jpg', title: "Woman Splashing Water At Beach", author: "Angelina Litvin", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Woman_splashing_water_at_beach_(Unsplash).jpg" },
  'people-window': { file: 'people-window.jpg', title: "Smiling Woman By A Window (Unsplash NoRsyXmHGpI)", author: "Brooke Cagle", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Smiling_woman_by_a_window_(Unsplash_NoRsyXmHGpI).jpg" },
  'road-truck': { file: 'road-truck.jpg', title: "Rusted Truck Great Ocean Road", author: "Jamie R. Mink", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Rusted_truck_Great_Ocean_Road_(Unsplash).jpg" },
  'sky-balloon': { file: 'sky-balloon.jpg', title: "Hot Air Balloon In Mountains", author: "Thomas Kelley", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:Hot_air_balloon_in_mountains_(Unsplash).jpg" },
  'street-night': { file: 'street-night.jpg', title: "The Food Of The City.", author: "Andre Benz", license: "CC0", source: "https://commons.wikimedia.org/wiki/File:The_Food_of_The_City._(Unsplash).jpg" },
} satisfies Record<string, TemplatePhoto>;

export type TemplatePhotoId = keyof typeof TEMPLATE_PHOTOS;

/** Bundled photos are served from the app itself, never from the network. */
export function bundledPhotoUrl(file: string) {
  return `${import.meta.env.BASE_URL}templates/${file}`;
}
export function templatePhotoUrl(id: TemplatePhotoId) {
  return bundledPhotoUrl(TEMPLATE_PHOTOS[id].file);
}

/** Neutral placeholder used when one bundled file cannot be read. */
export const FALLBACK_PHOTO_FILE = 'fallback.jpg';

const dataUrls = new Map<string, string>();

/**
 * Reads a bundled photo into a data URL, because a project embeds its media
 * (that is what keeps a saved story self-contained). Results are cached for
 * the session, so using one photo in several templates costs a single read.
 */
export async function bundledPhotoDataUrl(file: string): Promise<string> {
  const cached = dataUrls.get(file);
  if (cached) return cached;
  const response = await fetch(bundledPhotoUrl(file));
  if (!response.ok) throw new Error(`Template photo ${file} could not be read.`);
  const blob = await response.blob();
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('A template photo could not be read.'));
    reader.readAsDataURL(blob);
  });
  dataUrls.set(file, data);
  return data;
}
export function templatePhotoDataUrl(id: TemplatePhotoId) {
  return bundledPhotoDataUrl(TEMPLATE_PHOTOS[id].file);
}
