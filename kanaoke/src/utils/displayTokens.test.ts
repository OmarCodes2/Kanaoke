/**
 * Test/example helper for display token merging.
 * This file can be imported in development to test the buildDisplayTokens function.
 */

import type { TokenizedToken } from '../types';
import { buildDisplayTokens, logDisplayTokenExample } from './displayTokens';

/**
 * Creates a mock TokenizedToken for testing.
 */
function createToken(
  surface: string,
  pos: string = '名詞',
  base?: string,
  reading?: string,
): TokenizedToken {
  let charStart = 0;
  return {
    surface,
    base: base || surface,
    reading: reading || '',
    pronunciation: reading || '',
    pos,
    posDetail1: '',
    posDetail2: '',
    posDetail3: '',
    wordPosition: 1,
    charStart,
    charEnd: charStart + surface.length,
  };
}

/**
 * Helper to build tokens with proper charStart/charEnd positions.
 */
function buildTokens(tokens: Array<{ surface: string; pos: string; base?: string }>): TokenizedToken[] {
  let currentPos = 0;
  return tokens.map((t) => {
    const token: TokenizedToken = {
      surface: t.surface,
      base: t.base || t.surface,
      reading: '',
      pronunciation: '',
      pos: t.pos,
      posDetail1: '',
      posDetail2: '',
      posDetail3: '',
      wordPosition: 1,
      charStart: currentPos,
      charEnd: currentPos + t.surface.length,
    };
    currentPos = token.charEnd;
    return token;
  });
}

/**
 * Run example tests for display token merging.
 * Call this in development to see before/after examples.
 */
export function runDisplayTokenExamples(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('runDisplayTokenExamples should only be called in development');
    return;
  }

  console.log('=== Display Token Merging Examples ===\n');

  // Example 1: 忘れて -> ["忘れ", "て"]
  console.log('Example 1: 忘れて');
  const example1 = buildTokens([
    { surface: '忘れ', pos: '動詞', base: '忘れる' },
    { surface: 'て', pos: '助詞' },
  ]);
  logDisplayTokenExample(example1);
  console.log('');

  // Example 2: きて -> ["き", "て"]
  console.log('Example 2: きて');
  const example2 = buildTokens([
    { surface: 'き', pos: '動詞', base: 'くる' },
    { surface: 'て', pos: '助詞' },
  ]);
  logDisplayTokenExample(example2);
  console.log('');

  // Example 3: 食べた -> ["食べ", "た"]
  console.log('Example 3: 食べた');
  const example3 = buildTokens([
    { surface: '食べ', pos: '動詞', base: '食べる' },
    { surface: 'た', pos: '助動詞' },
  ]);
  logDisplayTokenExample(example3);
  console.log('');

  // Example 4: 食べません -> ["食べ", "ませ", "ん"]
  console.log('Example 4: 食べません (polite negative)');
  const example4 = buildTokens([
    { surface: '食べ', pos: '動詞', base: '食べる' },
    { surface: 'ませ', pos: '助動詞' },
    { surface: 'ん', pos: '助動詞' },
  ]);
  logDisplayTokenExample(example4);
  console.log('');

  // Example 5: 食べました -> ["食べ", "まし", "た"]
  console.log('Example 5: 食べました (polite past)');
  const example5 = buildTokens([
    { surface: '食べ', pos: '動詞', base: '食べる' },
    { surface: 'まし', pos: '助動詞' },
    { surface: 'た', pos: '助動詞' },
  ]);
  logDisplayTokenExample(example5);
  console.log('');

  // Example 6: 美しくない -> ["美しく", "ない"]
  console.log('Example 6: 美しくない (adjective negative)');
  const example6 = buildTokens([
    { surface: '美しく', pos: '形容詞', base: '美しい' },
    { surface: 'ない', pos: '助動詞' },
  ]);
  logDisplayTokenExample(example6);
  console.log('');

  // Example 7: Non-mergeable tokens (should remain separate)
  console.log('Example 7: Non-mergeable (名詞 + 助詞)');
  const example7 = buildTokens([
    { surface: '本', pos: '名詞' },
    { surface: 'を', pos: '助詞' },
  ]);
  logDisplayTokenExample(example7);
  console.log('');

  // Example 8: Multiple merges in sequence
  console.log('Example 8: Multiple merges in sequence');
  const example8 = buildTokens([
    { surface: '忘れ', pos: '動詞', base: '忘れる' },
    { surface: 'て', pos: '助詞' },
    { surface: '本', pos: '名詞' },
    { surface: 'を', pos: '助詞' },
    { surface: '読ん', pos: '動詞', base: '読む' },
    { surface: 'だ', pos: '助動詞' },
  ]);
  logDisplayTokenExample(example8);
  console.log('');

  console.log('=== End Examples ===');
}

// Auto-run in development if this file is imported
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Only run if explicitly called, not auto-run
  // Uncomment the line below to auto-run examples on import:
  // runDisplayTokenExamples();
}


