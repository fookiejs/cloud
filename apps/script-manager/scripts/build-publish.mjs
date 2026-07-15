import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const serverDist = join(repoRoot, 'packages', 'server', 'dist');
const cliRoot = join(repoRoot, 'packages', 'cli');
const cliDistServer = join(cliRoot, 'dist-server');

function run(cmd) {
  execSync(cmd, { cwd: repoRoot, stdio: 'inherit', shell: true });
}

function pruneDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      pruneDir(p);
      continue;
    }
    if (entry.name.endsWith('.test.js') || entry.name.endsWith('.map')) {
      rmSync(p);
    }
  }
}

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(p));
      continue;
    }
    out.push(p);
  }
  return out;
}

function verifyPublishBundle() {
  const bundleRoots = ['dist', 'dist-server', 'public'];
  for (const rootName of bundleRoots) {
    const root = join(cliRoot, rootName);
    if (!existsSync(root)) {
      console.error(`[build-publish] missing ${rootName}/`);
      process.exit(1);
    }
    for (const file of walkFiles(root)) {
      const rel = file.slice(cliRoot.length + 1).replaceAll('\\', '/');
      if (rel.endsWith('.test.js')) {
        console.error(`[build-publish] test artifact in bundle: ${rel}`);
        process.exit(1);
      }
      if (rel.endsWith('.ts') || rel.endsWith('.tsx')) {
        console.error(`[build-publish] source in bundle: ${rel}`);
        process.exit(1);
      }
    }
  }
}

run('npm --workspace @lotaru/web run build');

if (existsSync(serverDist)) {
  rmSync(serverDist, { recursive: true, force: true });
}
run('npm --workspace @lotaru/server run build');

if (!existsSync(serverDist)) {
  console.error('[build-publish] server dist missing');
  process.exit(1);
}

pruneDir(serverDist);

if (existsSync(cliDistServer)) {
  rmSync(cliDistServer, { recursive: true, force: true });
}
mkdirSync(cliDistServer, { recursive: true });
cpSync(serverDist, cliDistServer, { recursive: true });
pruneDir(cliDistServer);
console.log('[build-publish] copied server/dist -> cli/dist-server');

run('node scripts/cp-public.mjs');
run('npm --workspace @umudik/lotaru run build');

verifyPublishBundle();

console.log('[build-publish] done');
