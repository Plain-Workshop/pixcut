import json, os, shutil, subprocess

SRC = '/tmp/pixcut-photos'
OUT = '/Users/dawidof/Sites/pixcut/desktop/public/templates'
os.makedirs(OUT, exist_ok=True)

mapping = {
    'nature-mist': 'cloudy-mountains-unsplash-jpg.jpg',
    'nature-ridge': 'hazy-mountaintops-at-dusk-unsplash-jpg.jpg',
    'nature-valley': 'alone-in-the-unspoilt-wilderness-unsplash-jpg.jpg',
    'nature-pines': 'fog-descending-on-a-pine-forest-unsplash-jpg.jpg',
    'nature-river': 'forest-snow-in-sun-unsplash-jpg.jpg',
    'nature-peak': 'matterhorn-sunset-2016-unsplash-jpg.jpg',
    'nature-aurora': 'lofoten-norway-unsplash-jpg.jpg',
    'coast-waves': 'ocean-and-waves-unsplash-jpg.jpg',
    'coast-rocks': 'rocky-ocean-lagoon-unsplash-jpg.jpg',
    'coast-sunset': 'tranquil-red-and-pink-sunset-over-water-unsplash-j.jpg',
    'city-venice': 'venice-cityscape-sunset-unsplash-jpg.jpg',
    'sky-balloon': 'hot-air-balloon-in-mountains-unsplash-jpg.jpg',
    'people-beach': 'woman-walking-on-a-sand-beach-unsplash-jpg.jpg',
    'people-shore': 'woman-on-a-slope-by-the-shore-unsplash-jpg.jpg',
    'people-splash': 'woman-splashing-water-at-beach-unsplash-jpg.jpg',
    'people-window': 'smiling-woman-by-a-window-unsplash-norsyxmhgpi-jpg.jpg',
    'people-snow': 'woman-in-a-snowy-forest-unsplash-jpg.jpg',
    'people-portrait': 'portrait-unsplash-jpg.jpg',
    'people-man': 'face-portrait-unsplash-jpg.jpg',
    'friends-girls': 'photographer-friends-unsplash-jpg.jpg',
    'friends-boys': 'good-old-school-friends-unsplash-jpg.jpg',
    'couple-beach': 'couple-in-paradise-unsplash-jpg.jpg',
    'couple-sunset': 'pink-sunset-couple-unsplash-jpg.jpg',
    'couple-cozy': 'seated-couple-snuggling-unsplash-jpg.jpg',
    'couple-wedding': 'wedding-couple-on-a-footbridge-unsplash-jpg.jpg',
    'hands-autumn': 'lakeside-proposal-unsplash-jpg.jpg',
    'action-jump': 'happy-couple-unsplash-jpg.jpg',
    'food-brunch': 'brunching-with-friends-unsplash-jpg.jpg',
    'food-street': 'asian-street-food-vendor-unsplash-jpg.jpg',
    'coffee-friends': 'coffee-and-friends-unsplash-jpg.jpg',
    'street-night': 'the-food-of-the-city-unsplash-jpg.jpg',
    'fashion-car': 'woman-shopping-car-unsplash-jpg.jpg',
    'road-truck': 'rusted-truck-great-ocean-road-unsplash-jpg.jpg',
}

manifest = json.load(open(os.path.join(SRC, 'manifest.json')))
credits = {}
total = 0
for name, file in mapping.items():
    source = os.path.join(SRC, file)
    if not os.path.exists(source):
        print('MISSING', file)
        continue
    destination = os.path.join(OUT, f'{name}.jpg')
    subprocess.run(['sips', '-Z', '1200', '-s', 'format', 'jpeg', '-s', 'formatOptions', '72', source, '--out', destination],
                   check=True, capture_output=True)
    size = os.path.getsize(destination)
    total += size
    key = file[:-4]
    meta = manifest.get(key, {})
    author = meta.get('author', '').strip()
    # Commons artist fields often append the account handle; keep the display name.
    parts = author.split()
    if len(parts) > 1 and parts[-1].islower():
        author = ' '.join(parts[:-1])
    credits[name] = {
        'title': meta.get('title', '').replace('.jpg', '').replace(' (Unsplash)', '').strip(),
        'author': author or 'Unsplash contributor',
        'license': meta.get('license', 'CC0'),
        'source': meta.get('page', ''),
    }
    print(f'{name:18} {size // 1024:4} KB  {credits[name]["author"]}')

json.dump(credits, open(os.path.join(OUT, 'credits.json'), 'w'), indent=1, ensure_ascii=False)
print(f'total {total / 1e6:.1f} MB, {len(credits)} photos')
