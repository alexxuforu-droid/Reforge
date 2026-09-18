// X-1 — hardcoded UI string guard.
//
// Fails when views/components gain NEW hardcoded user-visible strings.
// Uses the TypeScript compiler API (no type-check) to flag:
//   - JSX text nodes with 3+ chars containing letters
//   - string literals in UI slots: title/subtitle/label/description/
//     placeholder/aria-label/ariaLabel/confirmLabel/heading/sub
//
// BASELINE is a ratchet: lowering it is welcome (update the number when an
// extraction slice lands); raising it fails the gate. Run:
//   node scripts/check-i18n-hardcoded.mjs
import ts from "typescript";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Total violations measured 2026-09-18 (motion set). Lower on every
// extraction slice; the gate fails if the count ever rises above this.
const BASELINE = 934;

const UI_PROPS = new Set([
  "title", "subtitle", "label", "description", "placeholder", "aria-label",
  "ariaLabel", "confirmLabel", "heading", "sub", "hint", "emptyText",
]);

function hasLetters(s) {
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(s);
}

function isSkippedPath(p) {
  const n = p.replace(/\\/g, "/");
  return (
    n.includes("src/i18n/") ||
    n.endsWith(".test.tsx") ||
    n.endsWith(".test.ts") ||
    n.includes("/test/") ||
    n.includes("src/components/icons")
  );
}

function collectFiles(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "node_modules" || e === "dist") continue;
      collectFiles(p, out);
    } else if (p.endsWith(".tsx") && !isSkippedPath(p)) {
      out.push(p);
    }
  }
  return out;
}

function countFile(path) {
  const src = readFileSync(path, "utf8");
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let count = 0;
  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text.length >= 3 && hasLetters(text)) count++;
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent;
      if (
        parent &&
        ts.isJsxAttribute(parent) &&
        UI_PROPS.has(parent.name.text) &&
        node.text.trim().length >= 3 &&
        hasLetters(node.text)
      ) {
        count++;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);
  return count;
}

const files = collectFiles("src");
let total = 0;
const perFile = [];
for (const f of files) {
  const n = countFile(f);
  if (n > 0) {
    total += n;
    perFile.push([n, f]);
  }
}
perFile.sort((a, b) => b[0] - a[0]);

console.log(`check-i18n-hardcoded: ${total} hardcoded UI strings across ${perFile.length} files (baseline ${BASELINE})`);
for (const [n, f] of perFile.slice(0, 15)) console.log(`  ${n}\t${f}`);

if (total > BASELINE) {
  console.error(`I18N FAIL — ${total} hardcoded strings exceed baseline ${BASELINE}. Extract strings to src/i18n/*.json instead of adding new literals.`);
  process.exit(1);
}
console.log("I18N OK");
