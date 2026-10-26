import os, subprocess, json

files = sorted(f for f in os.listdir('/tmp/pixcut-photos') if f.endswith('.jpg'))
chunks = [files[i:i + 12] for i in range(0, len(files), 12)]
os.makedirs('/tmp/pixcut-photos/sheets', exist_ok=True)
mapping = {}
layout = '|'.join(f'{(i % 4) * 320}_{(i // 4) * 220}' for i in range(12))
for index, chunk in enumerate(chunks, 1):
    args = ['ffmpeg', '-y', '-loglevel', 'error']
    for name in chunk:
        args += ['-i', f'/tmp/pixcut-photos/{name}']
    pads = []
    for i in range(len(chunk)):
        pads.append(f'[{i}:v]scale=320:220:force_original_aspect_ratio=increase,crop=320:220,pad=320:220:(ow-iw)/2:(oh-ih)/2:black[v{i}]')
    labels = ''.join(f'[v{i}]' for i in range(len(chunk)))
    if len(chunk) < 12:
        pads.append(f'color=c=black:s=320x220:d=1[blank]')
        labels += '[blank]' * (12 - len(chunk))
    graph = ';'.join(pads) + f';{labels}xstack=inputs=12:layout={layout}:fill=black'
    args += ['-filter_complex', graph, '-frames:v', '1', f'/tmp/pixcut-photos/sheets/sheet-{index}.png']
    subprocess.run(args, check=False)
    mapping[f'sheet-{index}'] = chunk
    print(index, len(chunk))
json.dump(mapping, open('/tmp/pixcut-photos/sheets/map.json', 'w'), indent=1)
