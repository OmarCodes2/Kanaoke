import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import kuromoji from 'kuromoji';
import type { IpadicFeatures } from 'kuromoji';
import type { TokenizedData, TokenizedLine, TokenizedToken } from '../types';

let tokenizerPromise: Promise<kuromoji.Tokenizer<IpadicFeatures>> | null = null;

function getKuromojiDictPath(): string {
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    const nodeModulesPath = path.join(__dirname, '../../node_modules/kuromoji/dict');
    return nodeModulesPath;
  }

  const appPath = app.getAppPath();
  
  if (appPath.endsWith('.asar')) {
    const unpackedPath = appPath.replace('.asar', '.asar.unpacked');
    const dictPath = path.join(unpackedPath, 'node_modules/kuromoji/dict');
    return dictPath;
  } else {
    const dictPath = path.join(appPath, 'node_modules/kuromoji/dict');
    return dictPath;
  }
}

export async function getTokenizer(): Promise<kuromoji.Tokenizer<IpadicFeatures>> {
  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    const dicPath = getKuromojiDictPath();
    
    kuromoji.builder({ dicPath })
      .build((err, tokenizer) => {
        if (err) {
          console.error('Failed to build kuromoji tokenizer:', err);
          reject(err);
          return;
        }
        if (!tokenizer) {
          reject(new Error('Tokenizer is null'));
          return;
        }
        resolve(tokenizer);
      });
  });

  return tokenizerPromise;
}

function tokenizeLine(
  tokenizer: kuromoji.Tokenizer<IpadicFeatures>,
  line: string,
): TokenizedLine {
  const tokens = tokenizer.tokenize(line);
  
  let currentPos = 0;
  
  const tokenizedTokens: TokenizedToken[] = tokens.map((token, index) => {
    const wordPosition = token.word_position || index + 1;
    
    const charStart = currentPos;
    const charEnd = charStart + token.surface_form.length;
    
    currentPos = charEnd;

    return {
      surface: token.surface_form,
      base: token.basic_form || token.surface_form,
      reading: token.reading || '',
      pronunciation: token.pronunciation || token.reading || '',
      pos: token.pos || '',
      posDetail1: token.pos_detail_1 || '',
      posDetail2: token.pos_detail_2 || '',
      posDetail3: token.pos_detail_3 || '',
      wordPosition,
      charStart,
      charEnd,
    };
  });

  return {
    raw: line,
    tokens: tokenizedTokens,
  };
}

export async function tokenizeLyrics(lyrics: string[]): Promise<TokenizedData> {
  const tokenizer = await getTokenizer();
  
  const lines: TokenizedLine[] = lyrics.map((line) => {
    if (!line.trim()) {
      return {
        raw: line,
        tokens: [],
      };
    }
    return tokenizeLine(tokenizer, line);
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    source: 'kuromoji',
    lines,
  };
}

