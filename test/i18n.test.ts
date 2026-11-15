import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../src/lib/i18n.js';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'locales' ? [] : sourceFiles(p);
    return /\.(astro|ts)$/.test(e.name) && e.name !== 'i18n.ts' ? [p] : [];
  });
}

/** Every text passed as a literal to t() or plural() in the pages and helpers. */
function sourceMessages(): Set<string> {
  const found = new Set<string>();
  const literal = `('(?:[^'\\\\\\n]|\\\\.)*'|"(?:[^"\\\\\\n]|\\\\.)*")`;
  const calls = [
    new RegExp(`\\bt\\(\\s*${literal}`, 'g'),
    new RegExp(`\\bplural\\(\\s*[^,()]+,\\s*${literal}`, 'g'),
  ];
  for (const file of sourceFiles(srcDir)) {
    const text = readFileSync(file, 'utf8');
    for (const call of calls)
      for (const m of text.matchAll(call)) found.add(m[1]!.slice(1, -1).replace(/\\(.)/g, '$1'));
  }
  return found;
}

const placeholders = (s: string): string[] =>
  [...new Set([...s.matchAll(/\{\d+\}/g)].map((m) => m[0]))].sort();

describe('translations of the site', () => {
  const messages = sourceMessages();

  it('finds the texts of the pages', () => {
    expect(messages.size).toBeGreaterThan(80);
  });

  it.each(LOCALES.filter((l) => l !== 'en'))(
    'le catalogue %s traduit chaque texte, et rien d’autre',
    (locale) => {
      const catalog = JSON.parse(
        readFileSync(path.join(srcDir, 'locales', `${locale}.json`), 'utf8'),
      ) as Record<string, string>;
      const keys = Object.keys(catalog);
      expect(
        [...messages].filter((m) => !(m in catalog)),
        'textes sans traduction',
      ).toEqual([]);
      expect(
        keys.filter((k) => !messages.has(k)),
        'traductions de textes disparus',
      ).toEqual([]);
      expect(keys).toEqual([...keys].sort());
      for (const [source, translation] of Object.entries(catalog)) {
        expect(translation.trim(), source).not.toBe('');
        expect(placeholders(translation), source).toEqual(placeholders(source));
        // A language gives one or two forms to a text that depends on a count, never more.
        expect(translation.split('|').length, source).toBeLessThanOrEqual(source.split('|').length);
        // Texts inserted as HTML must not bring any tag.
        expect(translation, source).not.toMatch(/[<>]/);
      }
    },
  );
});
