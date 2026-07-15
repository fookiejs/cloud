import fs from "fs";
import path from "path";

const srcDir = path.join(import.meta.dirname, "src");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function fixOptionalTypeProps(content) {
  return content.replace(/^(\s+)(\w+)\?\: (.+);$/gm, (_m, indent, name, typeRaw) => {
    const type = typeRaw.trim();
    if (type.includes("| null")) return `${indent}${name}: ${type};`;
    if (type.includes("=>")) return `${indent}${name}: (${type}) | null;`;
    return `${indent}${name}: ${type} | null;`;
  });
}

function fixUndefinedInTypes(content) {
  return content
    .replace(/\| undefined/g, "| null")
    .replace(/undefined \|/g, "null |")
    .replace(/: undefined([,;\s}])/g, ": null$1")
    .replace(/= undefined([,;\s}])/g, "= null$1");
}

function fixLooseNotEq(content) {
  return content.replace(/!= null/g, "!== null");
}

function fixEmptyInterface(content) {
  return content.replace(
    /export interface (\w+) extends ([^{]+)\{\}/g,
    "export type $1 = $2;",
  );
}

function fixNullishCoalesce(content) {
  let prev = "";
  let current = content;
  const pattern = /([a-zA-Z0-9_$.[\]()]+)\s*\?\?\s*([a-zA-Z0-9_$.[\]()'"\s]+)/g;
  let guard = 0;
  while (prev !== current && guard < 20) {
    guard += 1;
    prev = current;
    current = current.replace(pattern, (_match, left, right) => {
      const l = left.trim();
      const r = right.trim();
      if (l.includes("?") || r.includes("?")) return _match;
      if (l.length > 100 || r.length > 60) return _match;
      return `(${l} !== null && ${l} !== void 0 ? ${l} : ${r})`;
    });
  }
  return current;
}

for (const file of walk(srcDir)) {
  let content = fs.readFileSync(file, "utf8");
  const original = content;
  content = fixEmptyInterface(content);
  content = fixOptionalTypeProps(content);
  content = fixUndefinedInTypes(content);
  content = fixLooseNotEq(content);
  content = fixNullishCoalesce(content);
  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("fixed", path.relative(srcDir, file));
  }
}
