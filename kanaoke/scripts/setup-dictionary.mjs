import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { loadDictionary } from '@scriptin/jmdict-simplified-loader';
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data', 'dictionary');
const sourcePath = path.join(dataDir, 'jmdict-eng.json');
const indexPath = path.join(dataDir, 'index.json');
const INDEX_VERSION = 1;

function normalizeReading(reading) {
  if (!reading) return '';
  let result = '';
  for (const char of reading) {
    const code = char.codePointAt(0);
    if (code >= 0x30a1 && code <= 0x30f6) {
      result += String.fromCodePoint(code - 0x60);
    } else {
      result += char;
    }
  }
  return result;
}

function addToIndexMap(map, key, id) {
  if (!key) return;
  if (!map[key]) map[key] = [];
  if (!map[key].includes(id)) map[key].push(id);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'kanaoke-dictionary-setup',
          Accept: 'application/vnd.github+json',
        },
      },
      (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          fetchJson(response.headers.location).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Request failed (${response.statusCode})`));
          return;
        }
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))));
        response.on('error', reject);
      },
    ).on('error', reject);
  });
}

async function resolveLatestJmdictAsset() {
  const release = await fetchJson(
    'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest',
  );
  const asset = release.assets.find(
    (item) =>
      /^jmdict-eng-\d/.test(item.name) &&
      !item.name.includes('-common-') &&
      !item.name.includes('examples') &&
      item.name.endsWith('.json.zip'),
  );
  if (!asset) {
    throw new Error('Could not find jmdict-eng JSON archive in latest release');
  }
  return asset;
}

async function extractJsonFromZip(zipPath, destPath) {
  const buffer = await fsPromises.readFile(zipPath);
  const zip = await JSZip.loadAsync(buffer);
  const jsonEntryName = Object.keys(zip.files).find(
    (name) => name.endsWith('.json') && !zip.files[name].dir,
  );
  if (!jsonEntryName) {
    throw new Error('No JSON file found inside JMdict archive');
  }
  const content = await zip.files[jsonEntryName].async('nodebuffer');
  await fsPromises.writeFile(destPath, content);
}

async function downloadToFile(url, destPath, totalBytes, onProgress) {
  onProgress?.(0);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'kanaoke-dictionary-setup',
      Accept: 'application/octet-stream',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  if (!response.body) {
    throw new Error('Download failed: empty response body');
  }

  const contentLength = Number(response.headers.get('content-length') ?? totalBytes);
  const file = fs.createWriteStream(destPath);
  const reader = response.body.getReader();
  let downloaded = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = Buffer.from(value);
      if (!file.write(chunk)) {
        await new Promise((resolve) => file.once('drain', resolve));
      }

      downloaded += chunk.length;
      const total = contentLength > 0 ? contentLength : totalBytes;
      if (total > 0) {
        onProgress?.(Math.min(100, Math.round((downloaded / total) * 100)));
      }
    }

    file.end();
    await finished(file);
  } catch (error) {
    file.destroy();
    await fsPromises.unlink(destPath).catch(() => undefined);
    throw error;
  }
}

async function downloadJmdict(destPath, onProgress) {
  const asset = await resolveLatestJmdictAsset();
  const zipPath = `${destPath}.zip.download`;
  await downloadToFile(asset.browser_download_url, zipPath, asset.size, (progress) => {
    onProgress?.(Math.min(90, progress));
  });
  onProgress?.(95);
  await extractJsonFromZip(zipPath, destPath);
  await fsPromises.unlink(zipPath);
  onProgress?.(100);
  return asset;
}

async function buildDictionaryIndex(sourcePath, onProgress) {
  const byKanji = {};
  const byKana = {};
  const entries = {};
  let metadata = null;
  let processed = 0;

  await new Promise((resolve, reject) => {
    loadDictionary('jmdict', sourcePath)
      .onMetadata((meta) => {
        metadata = meta;
      })
      .onEntry((word) => {
        const senses = word.sense
          .map((sense) => ({
            partOfSpeech: sense.partOfSpeech,
            appliesToKanji: sense.appliesToKanji,
            appliesToKana: sense.appliesToKana,
            glosses: sense.gloss.filter((gloss) => gloss.lang === 'eng').map((gloss) => gloss.text),
          }))
          .filter((sense) => sense.glosses.length > 0);

        if (senses.length === 0) return;

        const compact = {
          id: word.id,
          kanji: word.kanji.map((kanji) => ({ text: kanji.text, common: kanji.common })),
          kana: word.kana.map((kana) => ({ text: kana.text, common: kana.common })),
          senses,
        };

        entries[compact.id] = compact;
        for (const kanji of compact.kanji) addToIndexMap(byKanji, kanji.text, compact.id);
        for (const kana of compact.kana) {
          addToIndexMap(byKana, kana.text, compact.id);
          addToIndexMap(byKana, normalizeReading(kana.text), compact.id);
        }

        processed += 1;
        if (processed % 5000 === 0) onProgress?.(processed);
      })
      .onEnd(resolve)
      .parser.on('error', reject);
  });

  return {
    version: INDEX_VERSION,
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

async function main() {
  await fsPromises.mkdir(dataDir, { recursive: true });

  try {
    await fsPromises.access(sourcePath);
    console.log('JMdict source already present, skipping download.');
  } catch {
    console.log('Downloading latest JMdict English JSON...');
    const asset = await downloadJmdict(sourcePath, (progress) => {
      process.stdout.write(`\rDownload progress: ${progress}%`);
    });
    console.log(`\nDownloaded ${asset.name}`);
  }

  console.log('Building dictionary index...');
  const index = await buildDictionaryIndex(sourcePath, (processed) => {
    if (processed % 10000 === 0) {
      process.stdout.write(`\rProcessed ${processed.toLocaleString()} entries`);
    }
  });

  await fsPromises.writeFile(indexPath, JSON.stringify(index), 'utf8');
  console.log(`\nDictionary index written to ${indexPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
