import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(here, '../../package.json');

export interface PackageMetadata {
  name?: string;
  version?: string;
  description?: string;
}

export async function loadPackageMetadata(): Promise<PackageMetadata> {
  const raw = await readFile(packageJsonPath, 'utf8');
  return JSON.parse(raw) as PackageMetadata;
}
