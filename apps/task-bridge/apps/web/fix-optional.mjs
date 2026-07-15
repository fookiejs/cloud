import fs from "fs";

const files = process.argv.slice(2);

function fixNullish(content) {
  return content.replace(
    /([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\s*\?\?\s*([^;,)\]\n]+)/g,
    (_m, left, right) => {
      const l = left.trim();
      const r = right.trim();
      if (l.includes("?") || r.includes("?")) return _m;
      return `(${l} !== null ? ${l} : ${r})`;
    },
  );
}

function fixOptionalMember(content) {
  return content.replace(
    /([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+|\[[^\]]+\])*)\?\.([a-zA-Z0-9_$]+)/g,
    (_m, base, prop) => `(${base} !== null ? ${base}.${prop} : null)`,
  );
}

function fixOptionalCall(content) {
  return content.replace(
    /([a-zA-Z0-9_$]+)\?\.\(/g,
    (_m, name) => {
      return `(function(){ if (${name} !== null) { ${name}(`;
    },
  );
}

function fixOptionalIndex(content) {
  return content.replace(
    /([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)*)\?\.\[([^\]]+)\]/g,
    (_m, base, index) => `(${base} !== null ? ${base}[${index}] : null)`,
  );
}

function fixOptionalProps(content) {
  return content.replace(/^(\s+)(\w+)\?\: (.+);$/gm, (_m, indent, name, typeRaw) => {
    const type = typeRaw.trim();
    if (type.includes("| null")) return `${indent}${name}: ${type};`;
    return `${indent}${name}: ${type} | null;`;
  });
}

function fixUndefined(content) {
  return content
    .replace(/\| undefined/g, "| null")
    .replace(/undefined \|/g, "null |")
    .replace(/: undefined([,;\s}])/g, ": null$1")
    .replace(/= undefined([,;\s}])/g, "= null$1");
}

function fixNotEq(content) {
  return content.replace(/!= null/g, "!== null");
}

function fixNonNullAssertion(content) {
  return content.replace(/document\.getElementById\("root"\)!/, "document.getElementById(\"root\") as HTMLElement");
}

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let prev = "";
  let guard = 0;
  while (prev !== content && guard < 10) {
    guard += 1;
    prev = content;
    content = fixOptionalProps(content);
    content = fixUndefined(content);
    content = fixNotEq(content);
    content = fixOptionalIndex(content);
    content = fixOptionalMember(content);
    content = fixNullish(content);
  }
  content = fixOptionalCall(content);
  content = fixNonNullAssertion(content);
  fs.writeFileSync(file, content);
  console.log("fixed", file);
}
