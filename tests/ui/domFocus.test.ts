import { describe, it, expect } from 'vitest';
import { isTextInputTarget } from '@/ui/domFocus';

describe('isTextInputTarget', () => {
  it('treats form fields as typing targets', () => {
    expect(isTextInputTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextInputTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTextInputTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTextInputTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isTextInputTarget({ tagName: 'DIV', isContentEditable: true })).toBe(
      true,
    );
    expect(isTextInputTarget(null)).toBe(false);
  });
});
