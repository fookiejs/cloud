import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const pkgPath = join(process.cwd(), "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

let published = "0.0.0";
try {
  const out = execSync(`npm view ${pkg.name} version`, {
    stdio: ["ignore", "pipe", "ignore"],
  })
    .toString()
    .trim();
  if (out) published = out;
} catch {
  published = "0.0.0";
}

function parse(version) {
  const parts = version.split(".").map((value) => Number(value) || 0);
  return { major: parts[0] || 0, minor: parts[1] || 0, patch: parts[2] || 0 };
}

const current = parse(pkg.version);
const live = parse(published);

let next;
const currentIsNewer =
  current.major > live.major ||
  (current.major === live.major && current.minor > live.minor) ||
  (current.major === live.major &&
    current.minor === live.minor &&
    current.patch > live.patch);

if (currentIsNewer) {
  next = `${current.major}.${current.minor}.${current.patch}`;
} else {
  next = `${live.major}.${live.minor}.${live.patch + 1}`;
}

pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${next}\n`, { flag: "a" });
}

console.log(`[npm] Publishing version ${next} (live: ${published})`);
