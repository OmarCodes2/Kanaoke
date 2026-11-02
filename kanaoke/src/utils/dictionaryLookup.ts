import { normalizeReading } from './normalizeReading';

export interface CompactKanjiForm {
  text: string;
  common: boolean;
}

export interface CompactKanaForm {
  text: string;
  common: boolean;
}

export interface CompactSense {
  partOfSpeech: string[];
  appliesToKanji: string[];
  appliesToKana: string[];
  glosses: string[];
}

export interface CompactEntry {
  id: string;
  kanji: CompactKanjiForm[];
  kana: CompactKanaForm[];
  senses: CompactSense[];
}

export interface DictionaryIndex {
  version: number;
  meta: {
    jmdictVersion: string;
    dictDate: string;
    builtAt: string;
    sourceFile: string;
    sourcePath?: string;
    sourceMtimeMs?: number;
  };
  tags: Record<string, string>;
  byKanji: Record<string, string[]>;
  byKana: Record<string, string[]>;
  entries: Record<string, CompactEntry>;
}

export interface DictionaryLookupQuery {
  base: string;
  surface: string;
  reading: string;
}

export interface DictionarySenseResult {
  glosses: string[];
  partOfSpeech: string[];
}

export interface DictionaryLookupResult {
  id: string;
  kanji: string[];
  kana: string[];
  senses: DictionarySenseResult[];
  common: boolean;
}

export const DICTIONARY_INDEX_VERSION = 1;
export const MAX_LOOKUP_RESULTS = 3;
export const MAX_SENSES_PER_RESULT = 3;

function resolveTags(tags: Record<string, string>, keys: string[]): string[] {
  return keys.map((key) => tags[key] ?? key);
}

function isWildcard(value: string): boolean {
  return value === '*';
}

function senseApplies(
  sense: CompactSense,
  kanjiKey: string | null,
  readingKey: string | null,
): boolean {
  const kanjiOk =
    !kanjiKey ||
    isWildcard(sense.appliesToKanji[0]) ||
    sense.appliesToKanji.includes(kanjiKey);

  const readingOk =
    !readingKey ||
    isWildcard(sense.appliesToKana[0]) ||
    sense.appliesToKana.includes(readingKey);

  return kanjiOk && readingOk;
}

function collectCandidateIds(
  index: DictionaryIndex,
  kanjiKeys: string[],
  readingKey: string,
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  const addIds = (list: string[] | undefined) => {
    if (!list) {
      return;
    }
    for (const id of list) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  };

  for (const key of kanjiKeys) {
    addIds(index.byKanji[key]);
  }

  if (ids.length === 0 && readingKey) {
    addIds(index.byKana[readingKey]);
  }

  return ids;
}

function entryMatchesReading(entry: CompactEntry, readingKey: string): boolean {
  return entry.kana.some((kana) => normalizeReading(kana.text) === readingKey);
}

function entryIsCommon(entry: CompactEntry): boolean {
  return entry.kanji.some((k) => k.common) || entry.kana.some((k) => k.common);
}

function formatEntry(
  index: DictionaryIndex,
  entry: CompactEntry,
  kanjiKey: string | null,
  readingKey: string | null,
): DictionaryLookupResult {
  const applicableSenses = entry.senses
    .filter((sense) => senseApplies(sense, kanjiKey, readingKey))
    .slice(0, MAX_SENSES_PER_RESULT)
    .map((sense) => ({
      glosses: sense.glosses,
      partOfSpeech: resolveTags(index.tags, sense.partOfSpeech),
    }));

  const fallbackSenses =
    applicableSenses.length > 0
      ? applicableSenses
      : entry.senses.slice(0, MAX_SENSES_PER_RESULT).map((sense) => ({
          glosses: sense.glosses,
          partOfSpeech: resolveTags(index.tags, sense.partOfSpeech),
        }));

  return {
    id: entry.id,
    kanji: entry.kanji.map((k) => k.text),
    kana: entry.kana.map((k) => k.text),
    senses: fallbackSenses,
    common: entryIsCommon(entry),
  };
}

function scoreEntry(
  entry: CompactEntry,
  kanjiKeys: string[],
  readingKey: string,
): number {
  let score = 0;

  if (kanjiKeys.some((key) => entry.kanji.some((k) => k.text === key))) {
    score += 10;
  }

  if (readingKey && entryMatchesReading(entry, readingKey)) {
    score += 8;
  }

  if (entryIsCommon(entry)) {
    score += 4;
  }

  return score;
}

export function lookupInIndex(
  index: DictionaryIndex,
  query: DictionaryLookupQuery,
): DictionaryLookupResult[] {
  const readingKey = normalizeReading(query.reading);
  const kanjiKeys = [query.base, query.surface]
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== '*');

  const uniqueKanjiKeys = [...new Set(kanjiKeys)];
  const candidateIds = collectCandidateIds(index, uniqueKanjiKeys, readingKey);

  if (candidateIds.length === 0) {
    return [];
  }

  const primaryKanjiKey = uniqueKanjiKeys[0] ?? null;

  return candidateIds
    .map((id) => index.entries[id])
    .filter((entry): entry is CompactEntry => Boolean(entry))
    .sort((a, b) => scoreEntry(b, uniqueKanjiKeys, readingKey) - scoreEntry(a, uniqueKanjiKeys, readingKey))
    .slice(0, MAX_LOOKUP_RESULTS)
    .map((entry) => formatEntry(index, entry, primaryKanjiKey, readingKey || null))
    .filter((result) => result.senses.some((sense) => sense.glosses.length > 0));
}
