#!/usr/bin/env node
/**
 * Guard: no `lineHeight` on a single-line <TextInput> (iOS centering killer).
 *
 * On iOS a single-line UITextField with ANY lineHeight loses native vertical
 * centering — text drops and descenders (g/y/p) clip. The non-obvious source is
 * that Tailwind's NAMED text-size utilities (`text-sm`, `text-base`, `text-lg`,
 * …) set BOTH fontSize AND lineHeight. Arbitrary sizes (`text-[14px]`) set
 * fontSize only and are safe. `leading-*` and inline `style={{ lineHeight }}`
 * are the other sources.
 *
 * This script fails (exit 1) if any single-line TextInput carries one of those.
 * Multiline inputs top-align and are exempt. See AppTextField.tsx for the rule.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NATIVE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['app', 'components'];
const SKIP = new Set(['node_modules', '.expo', 'ios', 'android', '.turbo', 'dist']);

const NAMED_SIZE = /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)\b/;
const LEADING = /\bleading-(?!\[)/; // leading-5 etc.; arbitrary leading-[20px] also sets lineHeight so include it too:
const LEADING_ANY = /\bleading-/;
const INLINE_LH = /\blineHeight\b/;
const TAG_OPEN = /<(TextInput|BottomSheetTextInput)\b/g;

/** Remove JS/JSX comments so we never flag a className/lineHeight mentioned in a comment. */
function stripComments(s) {
  return s
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ') // {/* ... */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ') // /* ... */
    .replace(/\/\/[^\n]*/g, ' '); // // ...
}

/** From the index of `<TextInput`, return the text of the opening tag up to its closing `>`. */
function openingTag(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(from, i + 1);
  }
  return src.slice(from, from + 600);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const violations = [];
for (const dir of SCAN_DIRS) {
  let files;
  try {
    files = walk(join(NATIVE_ROOT, dir));
  } catch {
    continue;
  }
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('<TextInput') && !src.includes('<BottomSheetTextInput')) continue;
    for (const m of src.matchAll(TAG_OPEN)) {
      const tag = stripComments(openingTag(src, m.index));
      if (/\bmultiline\b/.test(tag)) continue; // exempt
      const line = src.slice(0, m.index).split('\n').length;
      const reasons = [];
      if (NAMED_SIZE.test(tag)) reasons.push(`named text-size ${tag.match(NAMED_SIZE)[0]}`);
      if (LEADING_ANY.test(tag)) reasons.push(`leading-* class`);
      if (INLINE_LH.test(tag)) reasons.push(`inline lineHeight`);
      if (reasons.length) {
        violations.push({ file: file.replace(`${NATIVE_ROOT}/`, ''), line, reasons });
      }
    }
  }
}

if (violations.length) {
  console.error(
    `\n✗ Single-line <TextInput> with a lineHeight source (breaks iOS vertical centering): ${violations.length}\n`
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  — ${v.reasons.join(', ')}`);
  }
  console.error(
    `\nFix: use an arbitrary font size (text-[14px], text-[16px]) instead of a named one\n` +
      `(text-sm/base/lg), drop any leading-*/lineHeight, or route the field through\n` +
      `components/AppTextField.tsx. Multiline inputs are exempt.\n`
  );
  process.exit(1);
}

console.log('✓ No single-line TextInput carries a lineHeight source.');
