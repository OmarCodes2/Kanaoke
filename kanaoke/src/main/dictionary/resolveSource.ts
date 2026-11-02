import fs from 'node:fs/promises';
import path from 'node:path';
import { extractJsonFromZip } from './downloadJmdict';

export async function resolveDictionaryJsonPath(
  sourcePath: string,
  workDir: string,
): Promise<string> {
  const lowerPath = sourcePath.toLowerCase();

  if (lowerPath.endsWith('.json')) {
    return sourcePath;
  }

  if (lowerPath.endsWith('.json.zip')) {
    await fs.mkdir(workDir, { recursive: true });
    const destPath = path.join(workDir, 'jmdict-eng.json');
    await extractJsonFromZip(sourcePath, destPath);
    return destPath;
  }

  throw new Error('Dictionary file must be a .json or .json.zip file');
}

export function isDictionarySourceFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return lowerPath.endsWith('.json') || lowerPath.endsWith('.json.zip');
}
