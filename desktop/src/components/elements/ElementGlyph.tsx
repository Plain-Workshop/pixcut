import { X, ArrowRight, AudioLines, Bell, Captions, Check, Circle, Columns2, Film, Flag, Hash, Heart, Images, Keyboard, Link as LinkIcon, ListChecks, ListVideo, MapPin, Maximize2, MessageCircle, Minus, MoreHorizontal, MousePointer2, Music, PlayCircle, Quote, ScanLine, Share2, Smartphone, Sparkles, Square, Star, ThumbsUp, Timer, Triangle, Type, Youtube } from 'lucide-react';
import { PresetGlyph } from './PresetGlyph';
import type { ElementKind } from '../../stores/model';

export function ElementGlyph({ kind, presetId, size = 18 }: { kind: ElementKind; presetId?: string; size?: number }) {
  if (presetId) return <PresetGlyph id={presetId} size={size} />;
  switch (kind) {
    case 'caption': return <Captions size={size} />;
    case 'chapter': return <ListVideo size={size} />;
    case 'callout': return <MapPin size={size} />;
    case 'keycaps': return <Keyboard size={size} />;
    case 'mouse': return <MousePointer2 size={size} />;
    case 'device': return <Smartphone size={size} />;
    case 'comparison': return <Columns2 size={size} />;
    case 'checklist': return <ListChecks size={size} />;
    case 'rating': return <Star size={size} />;
    case 'countdown': return <Timer size={size} />;
    case 'waveform': return <AudioLines size={size} />;
    case 'message': return <MessageCircle size={size} />;
    case 'qr': return <ScanLine size={size} />;
    case 'end-screen': return <Flag size={size} />;
    case 'burst': return <Sparkles size={size} />;
    case 'frame': return <Maximize2 size={size} />;
    case 'dots': return <MoreHorizontal size={size} />;
    case 'tape': return <Square size={size} />;
    case 'chevron': return <ArrowRight size={size} />;
    case 'label': case 'name-tag': return <Type size={size} />;
    case 'link': return <LinkIcon size={size} />;
    case 'quote': return <Quote size={size} />;
    case 'counter': return <Hash size={size} />;
    case 'status': return <Check size={size} />;
    case 'image': return <Images size={size} />;
    case 'video': return <Film size={size} />;
    case 'subscribe': return <Youtube size={size} />;
    case 'like': return <ThumbsUp size={size} />;
    case 'bell': return <Bell size={size} />;
    case 'comment': return <MessageCircle size={size} />;
    case 'share': return <Share2 size={size} />;
    case 'play': return <PlayCircle size={size} />;
    case 'progress': return <Minus size={size} />;
    case 'location': return <MapPin size={size} />;
    case 'music': return <Music size={size} />;
    case 'check': return <Check size={size} />;
    case 'cross': return <X size={size} />;
    case 'ring': return <Circle size={size} />;
    case 'cursor': return <MousePointer2 size={size} />;
    case 'underline': return <Minus size={size} />;
    case 'rectangle': return <Square size={size} />;
    case 'ellipse': return <Circle size={size} />;
    case 'triangle': return <Triangle size={size} />;
    case 'star': return <Star size={size} />;
    case 'sparkle': return <Sparkles size={size} />;
    case 'line': return <Minus size={size} />;
    case 'arrow': return <ArrowRight size={size} />;
    case 'heart': return <Heart size={size} />;
  }
}
