import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const src = join(repoRoot, 'packages', 'server', 'src', 'db', 'schema.sql');
const destDir = join(repoRoot, 'packages', 'server', 'dist', 'db');
const dest = join(destDir, 'schema.sql');

mkdirSync(destDir, { recursive: true });
cpSync(src, dest);
console.log('[cp-schema] copied schema.sql -> server/dist/db/');
