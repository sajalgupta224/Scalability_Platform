export function countTokensApprox(text: string): number {
  if (!text) return 0;
  const pieces = String(text)
    .trim()
    .split(/\s+/g)
    .flatMap((w) => w.split(/([\.,!?;:\(\)"'`\-]+)/g))
    .filter(Boolean);
  return pieces.length;
}
