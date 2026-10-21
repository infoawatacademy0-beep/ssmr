/**
 * Formats coin numbers using compact K and M suffixes (e.g. 1.5K, 24K, 2.4M).
 * Keeps numbers clean and readable without showing all long digits.
 */
export function formatCoins(amount?: number | null): string {
  const num = amount ?? 0;
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}
