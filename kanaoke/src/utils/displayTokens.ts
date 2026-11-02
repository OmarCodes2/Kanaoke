import type { TokenizedToken, DisplayToken } from '../types';

/**
 * Builds display tokens by merging common inflection patterns.
 * Merges verb/adjective stems with their inflection endings for better UX.
 */
export function buildDisplayTokens(tokens: TokenizedToken[]): DisplayToken[] {
  if (tokens.length === 0) {
    return [];
  }

  const displayTokens: DisplayToken[] = [];
  const mergeableSurfaces = new Set([
    'て',
    'で',
    'た',
    'だ',
    'ない',
    'なかっ',
    'なかった',
    'ます',
    'ました',
    'たい',
    'てる',
  ]);

  // Polite negative/past patterns that might be split
  const politePatterns = [
    ['ませ', 'ん'], // ません
    ['まし', 'た'], // ました
  ];

  let i = 0;
  while (i < tokens.length) {
    const currentToken = tokens[i];
    
    // Check if this token can start a merge (verb, adjective, or auxiliary)
    const canStartMerge =
      currentToken.pos === '動詞' ||
      currentToken.pos === '形容詞' ||
      currentToken.pos === '助動詞';

    if (!canStartMerge) {
      // No merge, add as single token
      displayTokens.push({
        surface: currentToken.surface,
        base: currentToken.base,
        reading: currentToken.reading,
        pronunciation: currentToken.pronunciation,
        charStart: currentToken.charStart,
        charEnd: currentToken.charEnd,
        underlyingTokens: [currentToken],
      });
      i++;
      continue;
    }

    // Try to merge with following tokens
    const mergedTokens: TokenizedToken[] = [currentToken];
    let j = i + 1;

    // Check for polite patterns first
    let foundPolitePattern = false;
    for (const [first, second] of politePatterns) {
      if (
        j < tokens.length &&
        tokens[j].surface === first &&
        j + 1 < tokens.length &&
        tokens[j + 1].surface === second
      ) {
        mergedTokens.push(tokens[j], tokens[j + 1]);
        j += 2;
        foundPolitePattern = true;
        break;
      }
    }

    // Continue merging additional tokens (whether we found a polite pattern or not)
    while (j < tokens.length) {
      const nextToken = tokens[j];
      const canMerge =
        // Check if surface is in allowlist
        mergeableSurfaces.has(nextToken.surface) ||
        // Or if POS is auxiliary or particle
        nextToken.pos === '助動詞' ||
        nextToken.pos === '助詞';

      if (!canMerge) {
        break;
      }

      mergedTokens.push(nextToken);
      j++;
    }

    // Build the merged display token
    const surface = mergedTokens.map((t) => t.surface).join('');
    const base = mergedTokens[0].base || mergedTokens[0].surface;
    
    // Concatenate readings if all tokens have readings
    const readings = mergedTokens
      .map((t) => t.reading)
      .filter((r) => r.length > 0);
    const reading = readings.length === mergedTokens.length
      ? readings.join('')
      : mergedTokens[0].reading || '';

    // Concatenate pronunciations if all tokens have pronunciations
    const pronunciations = mergedTokens
      .map((t) => t.pronunciation)
      .filter((p) => p.length > 0);
    const pronunciation = pronunciations.length === mergedTokens.length
      ? pronunciations.join('')
      : mergedTokens[0].pronunciation || reading;

    displayTokens.push({
      surface,
      base,
      reading,
      pronunciation,
      charStart: mergedTokens[0].charStart,
      charEnd: mergedTokens[mergedTokens.length - 1].charEnd,
      underlyingTokens: [...mergedTokens],
    });

    i = j;
  }

  return displayTokens;
}

/**
 * Dev helper to log before/after token merging for testing.
 */
export function logDisplayTokenExample(tokens: TokenizedToken[]): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.group('Display Token Example');
  console.log('Input tokens:', tokens.map((t) => ({
    surface: t.surface,
    pos: t.pos,
    base: t.base,
  })));
  
  const displayTokens = buildDisplayTokens(tokens);
  console.log('Output display tokens:', displayTokens.map((dt) => ({
    surface: dt.surface,
    base: dt.base,
    underlyingCount: dt.underlyingTokens.length,
    underlying: dt.underlyingTokens.map((t) => t.surface).join(' + '),
  })));
  console.groupEnd();
}

