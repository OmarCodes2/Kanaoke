import fs from 'node:fs/promises';
import path from 'node:path';
import { loadDictionary } from '@scriptin/jmdict-simplified-loader';
import type { JMdictDictionaryMetadata, JMdictWord } from '@scriptin/jmdict-simplified-types';
import {
  DICTIONARY_INDEX_VERSION,
  type CompactEntry,
  type DictionaryIndex,
} from '../../utils/dictionaryLookup';
import { normalizeReading } from '../../utils/normalizeReading';

function addToIndexMap(map: Record<string, string[]>, key: string, id: string): void {
  if (!key) {
    return;
  }
  if (!map[key]) {
    map[key] = [];
  }
  if (!map[key].includes(id)) {
    map[key].push(id);
  }
}

function toCompactEntry(word: JMdictWord): CompactEntry {
  return {
    id: word.id,
    kanji: word.kanji.map((kanji) => ({
      text: kanji.text,
      common: kanji.common,
    })),
    kana: word.kana.map((kana) => ({
      text: kana.text,
      common: kana.common,
    })),
    senses: word.sense
      .map((sense) => ({
        partOfSpeech: sense.partOfSpeech,
        appliesToKanji: sense.appliesToKanji,
        appliesToKana: sense.appliesToKana,
        glosses: sense.gloss
          .filter((gloss) => gloss.lang === 'eng')
          .map((gloss) => gloss.text),
      }))
      .filter((sense) => sense.glosses.length > 0),
  };
}

export async function buildDictionaryIndex(
  sourcePath: string,
  onProgress?: (processed: number) => void,
): Promise<DictionaryIndex> {
  const byKanji: Record<string, string[]> = {};
  const byKana: Record<string, string[]> = {};
  const entries: Record<string, CompactEntry> = {};

  let metadata: JMdictDictionaryMetadata | null = null;
  let processed = 0;

  await new Promise<void>((resolve, reject) => {
    const loader = loadDictionary('jmdict', sourcePath)
      .onMetadata((meta) => {
        metadata = meta;
      })
      .onEntry((word) => {
        const compact = toCompactEntry(word);
        if (compact.senses.length === 0) {
          return;
        }

        entries[compact.id] = compact;

        for (const kanji of compact.kanji) {
          addToIndexMap(byKanji, kanji.text, compact.id);
        }

        for (const kana of compact.kana) {
          addToIndexMap(byKana, kana.text, compact.id);
          addToIndexMap(byKana, normalizeReading(kana.text), compact.id);
        }

        processed += 1;
        if (processed % 5000 === 0) {
          onProgress?.(processed);
        }
      })
      .onEnd(() => resolve());

    loader.parser.on('error', reject);
  });

  if (!metadata) {
    throw new Error('Failed to read JMdict metadata');
  }

  onProgress?.(processed);

  return {
    version: DICTIONARY_INDEX_VERSION,
    meta: {
      jmdictVersion: metadata.version,
      dictDate: metadata.dictDate,
      builtAt: new Date().toISOString(),
      sourceFile: path.basename(sourcePath),
    },
    tags: metadata.tags,
    byKanji,
    byKana,
    entries,
  };
}

export async function writeDictionaryIndex(indexPath: string, index: DictionaryIndex): Promise<void> {
  await fs.mkdir(path.dirname(indexPath), { recursive: true });
  await fs.writeFile(indexPath, JSON.stringify(index), 'utf8');
}

export async function readDictionaryIndex(indexPath: string): Promise<DictionaryIndex> {
  const raw = await fs.readFile(indexPath, 'utf8');
  const parsed = JSON.parse(raw) as DictionaryIndex;
  if (parsed.version !== DICTIONARY_INDEX_VERSION) {
    throw new Error(`Unsupported dictionary index version: ${parsed.version}`);
  }
  return parsed;
}
