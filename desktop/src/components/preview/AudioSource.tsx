import { useEffect, useRef } from 'react';
export function AudioSource({ id, data, register }: { id: string; data: string; register: (id: string, element: HTMLAudioElement | null) => void }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (data.startsWith('pixcut-asset:')) {
      element.removeAttribute('src');
      element.load();
      return;
    }
    let url = data;
    const comma = data.indexOf(',');
    if (data.startsWith('data:') && comma >= 0) {
      try {
        const mime = data.slice(5, comma).replace(';base64', '');
        const raw = atob(data.slice(comma + 1));
        url = URL.createObjectURL(new Blob([Uint8Array.from(raw, c => c.charCodeAt(0))], { type: mime }));
      } catch { /* The media element can report an invalid source without crashing the editor. */ }
    }
    element.src = url;
    return () => {
      element.pause(); element.removeAttribute('src'); element.load();
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [data]);
  return <audio data-clip-id={id} preload="auto" hidden ref={element => { audio.current = element; register(id, element); }} />;
}
