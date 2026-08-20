export function getOrCreateMemberKey() {
  try {
    const existing = localStorage.getItem('werise_member_key');
    if (existing) return existing;
    const generated = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `wr-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('werise_member_key', generated);
    return generated;
  } catch {
    return `wr-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
