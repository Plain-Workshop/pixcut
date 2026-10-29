import { describe, expect, it } from 'vitest';
import { projectFingerprint } from '../src/stores/fingerprint';
import { exportState } from '../src/stores/library';
import { emptyProject } from '../src/stores/model';

const base = emptyProject('Trip');
const withImage = (image: string) => {
  const project = structuredClone(base);
  project.tracks[0].clips.push({ id: 's1', startTicks: 0, sourceInTicks: 0, durationTicks: 90, name: 'a.jpg', image, title: 'Hello', subtitle: '', color: '#fff', fit: 'cover' } as never);
  return { ...project, id: 'fixed' };
};

describe('project fingerprint', () => {
  it('ignores how media is held', () => {
    const saved = projectFingerprint(withImage(`pixcut-asset:${'a'.repeat(64)}`));
    const hydrated = projectFingerprint(withImage(`data:image/png;base64,${'A'.repeat(5000)}`));
    expect(hydrated).toBe(saved);
  });
  it('changes when the project is edited', () => {
    const before = projectFingerprint(withImage('data:image/png;base64,AAAA'));
    const edited = withImage('data:image/png;base64,AAAA');
    edited.tracks[0].clips[0].title = 'Goodbye';
    expect(projectFingerprint(edited)).not.toBe(before);
  });
});

describe('export state', () => {
  it('distinguishes never, current and changed', () => {
    expect(exportState({})).toBe('never');
    expect(exportState({ exportedAt: 1, exportedHash: 'x', contentHash: 'x' })).toBe('current');
    expect(exportState({ exportedAt: 1, exportedHash: 'x', contentHash: 'y' })).toBe('changed');
  });
  it('reads an export recorded before fingerprints existed as current', () => {
    expect(exportState({ exportedAt: 1 })).toBe('current');
  });
});
