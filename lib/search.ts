export function fuzzyMatch(value: string, query: string): boolean {
  const text = value.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (text.includes(q)) return true;

  let cursor = 0;
  for (const char of q) {
    cursor = text.indexOf(char, cursor);
    if (cursor === -1) return false;
    cursor += 1;
  }
  return true;
}

export function fuzzyAny(values: Array<string | null | undefined>, query: string): boolean {
  return values.some((value) => fuzzyMatch(value ?? "", query));
}
