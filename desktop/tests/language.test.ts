import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { textDirection, limitElementText } from '../src/components/text/language';
import { ElementTextField } from '../src/components/elements/ElementTextField';
import { edit, emptyProject, validateProject, type ElementLayer, type Scene } from '../src/stores/model';

describe('multilingual element labels', () => {
  it.each([
    ['123 · اشترك الآن', 'rtl'], ['♡ הרשמה לערוץ', 'rtl'],
    ['۱۲ دنبال کنید', 'rtl'], ['Subscribe · مرحبا', 'ltr'],
    ['Zażółć gęślą jaźń', 'ltr'], ['Підписатися', 'ltr'],
    ['チャンネル登録', 'ltr'], ['订阅频道', 'ltr'], ['구독하기', 'ltr'],
    ['सब्सक्राइब करें', 'ltr'], ['👍 1.2K', 'ltr'],
  ])('follows the first strong letter of %s', (label, direction) => {
    expect(textDirection(label)).toBe(direction);
  });
  it('counts supplementary characters once and never splits their surrogate pairs', () => {
    const label = limitElementText('👍'.repeat(81));
    expect(Array.from(label)).toHaveLength(80);
    expect(label).toBe('👍'.repeat(80));
    expect(limitElementText('Zapisz · 保存 · احفظ')).toBe('Zapisz · 保存 · احفظ');
  });
  it('allows automatic input direction without a UTF-16 maxlength blocking valid labels', () => {
    const html = renderToStaticMarkup(createElement(ElementTextField, {value: 'اشترك الآن', stage: () => {}, commit: () => {}}));
    expect(html).toContain('dir="auto"');
    expect(html).not.toContain('maxLength');
    expect(html).not.toContain('maxlength');
  });
  it.each(['Zażółć gęślą jaźń', 'Підписатися', 'チャンネル登録', '订阅', '구독하기', 'اشترك الآن', 'הרשמה', 'सब्सक्राइब करें', '👍'.repeat(80)])('preserves %s through save and reopening', label => {
    const scene: Scene = { id: 's', name: 'Scene', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' };
    const element: ElementLayer = { id: 'e', kind: 'subscribe', presetId: 'buttons-studio-01', label, x: .5, y: .5, width: .4, height: .2, rotation: 0, opacity: 100, color: '#FFBFA8', animation: 'none', startTicks: 0, durationTicks: 120 };
    const project = edit(emptyProject(), {type: 'add', scenes: [scene]});
    project.overlays = [element];
    expect(validateProject(JSON.parse(JSON.stringify(project))).overlays[0].label).toBe(label);
  });
});
