import { randomUUID } from 'node:crypto';
import type { AnkiCardDraft, AnkiSaveResult, AnkiStatus } from '../types';

const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const NOTE_TYPE = 'Kanaoke Vocabulary';
const DEFAULT_DECK = 'Japanese::Kanaoke';

type AnkiCard = AnkiCardDraft & {
  id: string;
  deckName: string;
};

// TODO: Add an offline queue and a separate sync experience once batch syncing is designed.

async function invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, version: 6, params }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    throw new Error('AnkiConnect is unavailable. Open Anki and enable AnkiConnect to sync cards.');
  }

  if (!response.ok) throw new Error(`AnkiConnect returned ${response.status}.`);
  const payload = (await response.json()) as { error?: string; result: T };
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function connected(): Promise<boolean> {
  try {
    await invoke<number>('version');
    return true;
  } catch {
    return false;
  }
}

async function ensureNoteType(): Promise<void> {
  const names = await invoke<string[]>('modelNames');
  if (names.includes(NOTE_TYPE)) return;

  await invoke('createModel', {
    modelName: NOTE_TYPE,
    inOrderFields: ['Expression', 'Reading', 'Meaning', 'Sentence', 'Sentence Translation'],
    css: `.card { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 22px; text-align: center; color: #222; } .expression { font-size: 42px; font-weight: 700; } .reading { color: #666; margin-top: 16px; } .meaning { margin: 10px 0 24px; } .context { margin-top: 22px; padding-top: 18px; border-top: 1px solid #ddd; font-size: 17px; line-height: 1.55; } .translation { color: #666; margin-top: 8px; }`,
    isCloze: false,
    cardTemplates: [{
      Name: 'Recognition',
      Front: '<div class="expression">{{Expression}}</div>',
      Back: '{{FrontSide}}<div class="reading">{{Reading}}</div><div class="meaning">{{Meaning}}</div><div class="context">{{Sentence}}</div>{{#Sentence Translation}}<div class="translation">{{Sentence Translation}}</div>{{/Sentence Translation}}',
    }],
  });
}

async function addCardToAnki(card: AnkiCard): Promise<AnkiSaveResult> {
  if (!await connected()) {
    throw new Error('Open Anki with AnkiConnect before adding a card.');
  }

  await ensureNoteType();
  const noteId = await invoke<number>('addNote', {
    note: {
      deckName: card.deckName,
      modelName: NOTE_TYPE,
      fields: {
        Expression: card.expression,
        Reading: card.reading,
        Meaning: card.meaning,
        Sentence: card.sentence,
        'Sentence Translation': card.sentenceTranslation,
      },
      tags: ['kanaoke', `kanaoke-card-${card.id}`, `kanaoke-song-${card.songId}`],
      options: { allowDuplicate: true },
    },
  });

  return { status: 'synced', message: `Added to ${card.deckName}.`, noteId };
}

export async function getAnkiStatus(): Promise<AnkiStatus> {
  const isConnected = await connected();
  const decks = isConnected ? await invoke<string[]>('deckNames') : [];
  return {
    connected: isConnected,
    message: isConnected
      ? 'Connected to Anki'
      : 'Open Anki with AnkiConnect to add a card.',
    decks: decks.sort((a, b) => a.localeCompare(b)),
  };
}

export async function getAnkiDecks(): Promise<string[]> {
  if (!await connected()) throw new Error('AnkiConnect is unavailable.');
  return (await invoke<string[]>('deckNames')).sort((a, b) => a.localeCompare(b));
}

export async function createAnkiDeck(name: string): Promise<string> {
  const deckName = name.trim();
  if (!deckName) throw new Error('Enter a deck name.');
  if (!await connected()) throw new Error('Open Anki with AnkiConnect before creating a deck.');
  await invoke('createDeck', { deck: deckName });
  return deckName;
}

export async function saveAnkiCard(draft: AnkiCardDraft, requestedDeckName: string): Promise<AnkiSaveResult> {
  if (!draft.expression.trim()) throw new Error('An expression is required.');
  if (!draft.meaning.trim()) throw new Error('A meaning is required.');

  const card: AnkiCard = {
    ...draft,
    id: randomUUID(),
    deckName: requestedDeckName.trim() || DEFAULT_DECK,
  };
  return addCardToAnki(card);
}
