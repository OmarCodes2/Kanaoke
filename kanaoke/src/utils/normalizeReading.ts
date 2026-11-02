/**
 * Converts katakana (full- and half-width) to hiragana for JMdict reading comparison.
 */
export function normalizeReading(reading: string): string {
  if (!reading) {
    return '';
  }

  let result = '';
  for (const char of reading) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      continue;
    }

    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
      continue;
    }

    if (code >= 0xff66 && code <= 0xff9d) {
      const fullWidth = code - 0xff66 + 0x30a2;
      if (fullWidth >= 0x30a2 && fullWidth <= 0x30f3) {
        result += String.fromCodePoint(fullWidth - 0x60);
      } else {
        result += char;
      }
      continue;
    }

    result += char;
  }

  return result;
}
