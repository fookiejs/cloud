import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "apps", "web", "dist");
const dest = join(root, "apps", "backend", "public");

if (!existsSync(join(src, "index.html"))) {
  console.error("apps/web/dist missing — run: npm --prefix apps/web run build");
  process.exit(1);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("Copied web dist -> apps/backend/public");
