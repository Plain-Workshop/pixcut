import { describe, expect, it } from 'vitest';
import { errorTitle, messageFor } from '../src/app/errors';

describe('error titles', () => {
  it('labels missing media as a relink problem, not a broken project', () => {
    expect(errorTitle('Relink missing media before saving this project.')).toBe('Media needs relinking');
    expect(errorTitle('Relink missing media before exporting this project.')).toBe('Media needs relinking');
  });

  it('keeps unreadable projects distinct from missing media', () => {
    expect(errorTitle('Unsupported project version 99.')).toBe('This project could not be opened');
    expect(errorTitle('A local asset failed its integrity check.')).toBe('That file could not be read');
  });

  it('turns empty errors into a calm, local-first message', () => {
    expect(messageFor(new Error(''))).toBe('Something went wrong. Your work is still saved on this device.');
    expect(messageFor('error: Failed to fetch')).toBe('The local file could not be read. Try choosing it again.');
  });
});
