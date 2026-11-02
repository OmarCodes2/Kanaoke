import {
  lookupInIndex,
  type CompactEntry,
  type DictionaryIndex,
} from './dictionaryLookup';
import { normalizeReading } from './normalizeReading';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function createMockIndex(entries: CompactEntry[], tags: Record<string, string> = {}): DictionaryIndex {
  const byKanji: Record<string, string[]> = {};
  const byKana: Record<string, string[]> = {};
  const entryMap: Record<string, CompactEntry> = {};

  for (const entry of entries) {
    entryMap[entry.id] = entry;
    for (const kanji of entry.kanji) {
      byKanji[kanji.text] = [...(byKanji[kanji.text] ?? []), entry.id];
    }
    for (const kana of entry.kana) {
      byKana[kana.text] = [...(byKana[kana.text] ?? []), entry.id];
      const normalized = normalizeReading(kana.text);
      byKana[normalized] = [...(byKana[normalized] ?? []), entry.id];
    }
  }

  return {
    version: 1,
    meta: {
      jmdictVersion: 'test',
      dictDate: '2026-01-01',
      builtAt: '2026-01-01T00:00:00.000Z',
      sourceFile: 'test.json',
    },
    tags,
    byKanji,
    byKana,
    entries: entryMap,
  };
}

export function runDictionaryLookupTests(): void {
  assert(normalizeReading('セカイ') === 'せかい', 'katakana should normalize to hiragana');
  assert(normalizeReading('せかい') === 'せかい', 'hiragana should remain unchanged');

  const index = createMockIndex(
    [
      {
        id: '1',
        kanji: [{ text: '世界', common: true }],
        kana: [{ text: 'せかい', common: true }],
        senses: [
          {
            partOfSpeech: ['n'],
            appliesToKanji: ['*'],
            appliesToKana: ['*'],
            glosses: ['world', 'society'],
          },
        ],
      },
      {
        id: '2',
        kanji: [{ text: '本', common: true }],
        kana: [
          { text: 'ほん', common: true },
          { text: 'もと', common: false },
        ],
        senses: [
          {
            partOfSpeech: ['n'],
            appliesToKanji: ['本'],
            appliesToKana: ['ほん'],
            glosses: ['book'],
          },
          {
            partOfSpeech: ['n'],
            appliesToKanji: ['本'],
            appliesToKana: ['もと'],
            glosses: ['origin', 'source'],
          },
        ],
      },
      {
        id: '3',
        kanji: [{ text: '食べる', common: true }],
        kana: [{ text: 'たべる', common: true }],
        senses: [
          {
            partOfSpeech: ['v'],
            appliesToKanji: ['*'],
            appliesToKana: ['*'],
            glosses: ['to eat'],
          },
        ],
      },
    ],
    { n: 'noun', v: 'verb' },
  );

  const worldResults = lookupInIndex(index, {
    base: '世界',
    surface: '世界',
    reading: 'セカイ',
  });
  assert(worldResults.length === 1, 'world lookup should return one result');
  assert(worldResults[0].senses[0].glosses.includes('world'), 'world gloss should be present');

  const bookResults = lookupInIndex(index, {
    base: '本',
    surface: '本',
    reading: 'ホン',
  });
  assert(bookResults.length >= 1, 'book lookup should return a result');
  assert(
    bookResults[0].senses.some((sense) => sense.glosses.includes('book')),
    'book gloss should be selected by reading',
  );

  const verbResults = lookupInIndex(index, {
    base: '食べる',
    surface: '食べて',
    reading: 'タベ',
  });
  assert(verbResults.length === 1, 'verb lookup by base should return one result');
  assert(verbResults[0].senses[0].glosses.includes('to eat'), 'verb gloss should be present');

  const missingResults = lookupInIndex(index, {
    base: '存在しない',
    surface: '存在しない',
    reading: '',
  });
  assert(missingResults.length === 0, 'missing word should return no results');
}

if (require.main === module || process.argv[1]?.includes('dictionaryLookup.test')) {
  runDictionaryLookupTests();
  console.log('dictionary lookup tests passed');
}
