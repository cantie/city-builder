/** True when keyboard events should go to a form field, not the game camera. */
export function isTextInputTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return !!el.isContentEditable;
}
