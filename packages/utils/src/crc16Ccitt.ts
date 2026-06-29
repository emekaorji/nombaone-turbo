// CRC16-CCITT (poly 0x1021, init 0xFFFF), bitwise (no table)
// Fast enough for short IDs; tiny and dependency-free.
export function crc16Ccitt(str: string): number {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) & 0xff) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}
