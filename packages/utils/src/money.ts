export function toKobo(nairaAmount: number) {
  return Math.round((nairaAmount + Number.EPSILON) * 100);
}

export function fromKobo(koboAmount: number) {
  return Number((koboAmount / 100).toFixed(2));
}

export function nairaFromKoboString(koboAmount: number) {
  return fromKobo(koboAmount).toFixed(2);
}
