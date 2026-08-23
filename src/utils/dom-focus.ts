/** True when the user is typing in a DOM field (chat, busca, apelido, etc.). */
export function isTypingInField(target: EventTarget | null = document.activeElement): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}
