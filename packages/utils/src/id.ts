/**
 * Opaque random ids: `0-9`, `A-Z`, `a-z` (62 symbols), using `crypto.getRandomValues`
 * with rejection sampling so every character is unbiased.
 */

const BASE = 62;

/** `0-9` then `A-Z` then `a-z` */
const ID_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' as const;

const BYTE_REJECT_THRESHOLD = 256 - (256 % BASE);

function getCrypto() {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available in this environment');
  }
  return c;
}

const DEFAULT_ID_LENGTH = 8;

/**
 * Random string from {@link ID_ALPHABET}. Uniqueness in the database should still
 * be enforced with a `UNIQUE` constraint and retries on conflict.
 */
export function generateId(options?: { length?: number }): string {
  const length = options?.length ?? DEFAULT_ID_LENGTH;

  if (!Number.isInteger(length) || length < 1 || length > 256) {
    throw new RangeError('length must be an integer between 1 and 256');
  }

  const crypto = getCrypto();
  const buf = new Uint8Array(Math.min(length * 4, 4096));
  const chars: string[] = [];
  let filled = 0;

  while (filled < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && filled < length; i++) {
      const b = buf[i]!;
      if (b >= BYTE_REJECT_THRESHOLD) continue;
      chars.push(ID_ALPHABET[b % BASE]!);
      filled += 1;
    }
  }

  return chars.join('');
}

// console.log(generateId()); // ex. yUGfydtC
