import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const src = join(repoRoot, 'packages', 'web', 'dist');
const dest = join(repoRoot, 'packages', 'cli', 'public');

if (!existsSync(src)) {
  console.log('[cp-public] web dist not found, skipping');
  process.exit(0);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('[cp-public] copied web dist -> cli/public');
