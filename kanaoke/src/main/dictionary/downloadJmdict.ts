import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import https from 'node:https';
import { finished } from 'node:stream/promises';
import JSZip from 'jszip';

interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  assets: GitHubReleaseAsset[];
}

const JMDICT_RELEASES_API =
  'https://api.github.com/repos/scriptin/jmdict-simplified/releases/latest';

function isFullEnglishJmdictAsset(name: string): boolean {
  return (
    /^jmdict-eng-\d/.test(name) &&
    !name.includes('-common-') &&
    !name.includes('examples') &&
    name.endsWith('.json.zip')
  );
}

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          'User-Agent': 'kanaoke-dictionary-setup',
          Accept: 'application/vnd.github+json',
        },
      },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          fetchJson<T>(response.headers.location).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Request failed (${response.statusCode}) for ${url}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        response.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      },
    );

    request.on('error', reject);
  });
}

async function downloadToFile(
  url: string,
  destPath: string,
  totalBytes: number,
  onProgress?: (progress: number) => void,
): Promise<void> {
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
        await new Promise<void>((resolve) => file.once('drain', resolve));
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

export async function resolveLatestJmdictAsset(): Promise<GitHubReleaseAsset> {
  const release = await fetchJson<GitHubRelease>(JMDICT_RELEASES_API);
  const asset = release.assets.find((item) => isFullEnglishJmdictAsset(item.name));

  if (!asset) {
    throw new Error('Could not find jmdict-eng JSON archive in latest release');
  }

  return asset;
}

export async function extractJsonFromZip(zipPath: string, destPath: string): Promise<void> {
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

export async function downloadJmdict(
  destPath: string,
  onProgress?: (progress: number) => void,
): Promise<{ fileName: string; size: number }> {
  const asset = await resolveLatestJmdictAsset();
  await fsPromises.mkdir(path.dirname(destPath), { recursive: true });

  const zipPath = `${destPath}.zip.download`;
  await downloadToFile(asset.browser_download_url, zipPath, asset.size, (progress) => {
    onProgress?.(Math.min(90, progress));
  });

  onProgress?.(95);
  await extractJsonFromZip(zipPath, destPath);
  await fsPromises.unlink(zipPath);
  onProgress?.(100);

  return {
    fileName: asset.name,
    size: asset.size,
  };
}
