export function pickRandom<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) {
    throw new Error('Cannot pick a random item from an empty array');
  }
  return item;
}

export function randomDigits(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}
