/**
 * Nomba virtual-account NAME normalisation.
 *
 * `POST /v1/accounts/virtual` validates `accountName` far more narrowly than its
 * docs admit. Live-probed on 2026-07-13 — every one of these was REJECTED with
 * `Account name must not contain special characters.`:
 *
 *     "Iron Republic Gym 1"    (a digit)
 *     "IronRepublic2"          (a digit)
 *     "Mary-Jane O'Brien"      (hyphen, apostrophe)
 *     "Chidinma Okafor-Eze"    (hyphen)
 *     "Ade Ogunlana Ltd."      (period)
 *     "Iron Republic & Co"     (ampersand)
 *
 * while `"Iron Republic Gym"` succeeded. The accepted alphabet is **ASCII letters
 * and spaces, nothing else** — which excludes a large fraction of real Nigerian
 * customer and business names.
 *
 * That mattered a great deal, because Nomba signals this failure as **HTTP 200**
 * with `{"code":"400","status":false}`. Before `NombaResponse.ok` learned to read
 * the envelope, the transfer rail sailed past its `if (!res.ok)` guard and handed
 * the payer a NUBAN of `undefined`: a customer whose only distinguishing feature
 * was a hyphenated surname could never be given an account to pay into, so their
 * invoice went unpaid, dunned, and churned. Sanitising here is what keeps the
 * name from ever reaching Nomba in a shape it will refuse.
 *
 * This value is cosmetic — it becomes the payer-facing `bankAccountName`
 * ("Nomba/<name>"). Reconciliation keys off `accountRef`, never off this. So
 * mangling a name is always preferable to failing to issue the account.
 */

/** Nomba's documented bounds for `accountName`. */
const MIN_LEN = 8;
const MAX_LEN = 64;

/** Used when a name has no Latin letters at all (e.g. it is entirely non-Latin script). */
const FALLBACK = 'Nombaone Customer';

/**
 * Coerce any human/business name into something Nomba will accept: strip accents
 * to their ASCII base (`Ògúnlànà` → `Ogunlana`), drop every character that is not
 * a letter or a space, collapse whitespace, then fit it to 8–64 characters.
 */
export function toNombaAccountName(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .normalize('NFD') // decompose: é → e + combining acute
    .replace(/[\u0300-\u036f]/g, '') // drop the combining marks
    .replace(/[^A-Za-z ]+/g, ' ') // the ONLY alphabet Nomba accepts
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) return FALLBACK;

  if (cleaned.length > MAX_LEN) {
    // Prefer a word boundary so the payer sees a sane name, not a severed one.
    const cut = cleaned.slice(0, MAX_LEN);
    const lastSpace = cut.lastIndexOf(' ');
    const trimmed = (lastSpace >= MIN_LEN ? cut.slice(0, lastSpace) : cut).trim();
    return trimmed.length >= MIN_LEN ? trimmed : cut.trim();
  }

  if (cleaned.length < MIN_LEN) {
    // Short but valid names ("Ade Eze") must still clear the floor. Suffixing is
    // safe: the name is display-only, and `accountRef` carries the identity.
    const padded = `${cleaned} ${FALLBACK}`.slice(0, MAX_LEN).trim();
    return padded.length >= MIN_LEN ? padded : FALLBACK;
  }

  return cleaned;
}
