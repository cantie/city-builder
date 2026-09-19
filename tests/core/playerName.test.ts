import { describe, it, expect } from 'vitest';
import { normalizePlayerName } from '@/core/playerName';

describe('normalizePlayerName', () => {
  it('accepts 2–24 alphanumerics plus _- and lowercases', () => {
    expect(normalizePlayerName('Ada_1-x')).toBe('ada_1-x');
  });

  it('rejects empty, short, long, and special characters', () => {
    expect(normalizePlayerName('')).toBeNull();
    expect(normalizePlayerName('a')).toBeNull();
    expect(normalizePlayerName('a'.repeat(25))).toBeNull();
    expect(normalizePlayerName('ada bob')).toBeNull();
    expect(normalizePlayerName('ada/../x')).toBeNull();
  });
});
