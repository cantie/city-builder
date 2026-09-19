export function normalizePlayerName(raw: string): string | null {
  const name = raw.trim();
  if (!/^[a-zA-Z0-9_-]{2,24}$/.test(name)) return null;
  return name.toLowerCase();
}
