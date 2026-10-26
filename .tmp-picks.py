import os, subprocess, json

shortlist = [
    # nature
    'alone-in-the-unspoilt-wilderness-unsplash-jpg.jpg', 'cloudy-mountains-unsplash-jpg.jpg',
    'hazy-mountaintops-at-dusk-unsplash-jpg.jpg', 'fog-descending-on-a-pine-forest-unsplash-jpg.jpg',
    'forest-snow-in-sun-unsplash-jpg.jpg', 'forest-clearing-from-above-1-unsplash-jpg.jpg',
    'greener-pastures-unsplash-jpg.jpg', 'lake-fayetteville-fayetteville-united-states-unspl.jpg',
    'lofoten-norway-unsplash-jpg.jpg', 'matterhorn-sunset-2016-unsplash-jpg.jpg',
    'white-mountain-with-wooded-slopes-unsplash-jpg.jpg', 'ocean-and-waves-unsplash-jpg.jpg',
    'ocean-bay-view-unsplash-jpg.jpg', 'rocky-ocean-lagoon-unsplash-jpg.jpg',
    'pink-sunset-over-a-river-town-unsplash-jpg.jpg', 'tranquil-red-and-pink-sunset-over-water-unsplash-j.jpg',
    'venice-cityscape-sunset-unsplash-jpg.jpg', 'hot-air-balloon-in-mountains-unsplash-jpg.jpg',
    'chairlift-on-foggy-mountain-unsplash-jpg.jpg', 'table-mountain-unsplash-jpg.jpg',
    # people
    'woman-splashing-water-at-beach-unsplash-jpg.jpg', 'woman-walking-on-a-sand-beach-unsplash-jpg.jpg',
    'woman-on-a-slope-by-the-shore-unsplash-jpg.jpg', 'woman-in-a-snowy-forest-unsplash-jpg.jpg',
    'woman-red-hair-looking-at-sky-unsplash-jpg.jpg', 'smiling-woman-by-a-window-unsplash-norsyxmhgpi-jpg.jpg',
    'girl-in-forest-unsplash-jpg.jpg', 'face-portrait-unsplash-jpg.jpg',
    'portrait-unsplash-jpg.jpg', 'posing-for-a-portrait-unsplash-jpg.jpg',
    'siberian-portrait-unsplash-jpg.jpg', 'monochrome-portrait-unsplash-jpg.jpg',
    'new-friends-unsplash-jpg.jpg', 'friends-1-unsplash-jpg.jpg',
    'good-old-school-friends-unsplash-jpg.jpg', 'photographer-friends-unsplash-jpg.jpg',
    'travel-with-my-friends-unsplash-jpg.jpg', 'brunching-with-friends-unsplash-jpg.jpg',
    'couple-in-paradise-unsplash-jpg.jpg', 'couple-sitting-watching-sunset-unsplash-jpg.jpg',
    'pink-sunset-couple-unsplash-jpg.jpg', 'happy-couple-unsplash-jpg.jpg',
    'seated-couple-snuggling-unsplash-jpg.jpg', 'wedding-couple-on-a-footbridge-unsplash-jpg.jpg',
    'lakeside-proposal-unsplash-jpg.jpg', 'walking-on-winding-sands-unsplash-jpg.jpg',
    'goalkeeper-through-the-soccer-goal-net-unsplash-jp.jpg', 'the-box-room-at-the-gym-repeat-fitness-jpg.jpg',
    'food-photographer-unsplash-jpg.jpg', 'person-snapping-food-unsplash-jpg.jpg',
    'asian-street-food-vendor-unsplash-jpg.jpg', 'couple-sharing-umbrella-unsplash-jpg.jpg',
    # food + travel + city
    'morning-coffee-unsplash-jpg.jpg', 'coffee-and-friends-unsplash-jpg.jpg',
    'happy-hour-food-and-drinks-unsplash-jpg.jpg', 'pub-food-for-the-win-unsplash-jpg.jpg',
    'street-food-sandwich-unsplash-jpg.jpg', 'the-food-of-the-city-unsplash-jpg.jpg',
    'food-cutlery-and-beer-unsplash-jpg.jpg', 'woman-shopping-car-unsplash-jpg.jpg',
    'cn-tower-toronto-canada-unsplash-dj-kogh5u0o-jpg.jpg', 'one-way-sign-unsplash-jpg.jpg',
    'rusted-truck-great-ocean-road-unsplash-jpg.jpg', 'woman-and-road-smoke-cloud-unsplash-jpg.jpg',
    'yan-an-east-road-interchange-shanghai-china-unspla.jpg', 'abandoned-bus-in-san-pedro-de-atacama-unsplash-jpg.jpg',
    'fishing-boats-against-a-pink-sunset-unsplash-jpg.jpg',
]
shortlist = [name for name in shortlist if os.path.exists('/tmp/pixcut-photos/' + name)]
missing = [name for name in shortlist if not os.path.exists('/tmp/pixcut-photos/' + name)]
chunks = [shortlist[i:i + 9] for i in range(0, len(shortlist), 9)]
os.makedirs('/tmp/pixcut-photos/picks', exist_ok=True)
layout = '|'.join(f'{(i % 3) * 420}_{(i // 3) * 280}' for i in range(9))
mapping = {}
for index, chunk in enumerate(chunks, 1):
    args = ['ffmpeg', '-y', '-loglevel', 'error']
    for name in chunk:
        args += ['-i', '/tmp/pixcut-photos/' + name]
    pads = [f'[{i}:v]scale=420:280:force_original_aspect_ratio=increase,crop=420:280,format=rgb24[v{i}]' for i in range(len(chunk))]
    labels = ''.join(f'[v{i}]' for i in range(len(chunk)))
    if len(chunk) < 9:
        pads.append('color=c=black:s=420x280:d=1,format=rgb24[blank]')
        labels += '[blank]' * (9 - len(chunk))
    graph = ';'.join(pads) + f';{labels}xstack=inputs=9:layout={layout}:fill=black'
    args += ['-filter_complex', graph, '-frames:v', '1', f'/tmp/pixcut-photos/picks/board-{index}.png']
    subprocess.run(args, check=False)
    mapping[f'board-{index}'] = chunk
json.dump(mapping, open('/tmp/pixcut-photos/picks/map.json', 'w'), indent=1)
print('boards', len(chunks), 'photos', len(shortlist), 'missing', missing)
