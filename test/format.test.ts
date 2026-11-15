import { describe, expect, it } from 'vitest';
import { apiBase, searchQuery } from '../src/lib/api.js';
import {
  contrastRatio,
  formatDate,
  formatSize,
  parsePage,
  parseTool,
  scanSentence,
} from '../src/lib/format.js';
import { createI18n, negotiateLocale, pickLocale } from '../src/lib/i18n.js';

describe('aides d’affichage', () => {
  it('valide les paramètres d’URL', () => {
    expect(parseTool('cursor')).toBe('cursor');
    expect(parseTool('emacs')).toBeUndefined();
    expect(parseTool(null)).toBeUndefined();
    expect(parsePage('3')).toBe(3);
    for (const bad of ['0', '-1', 'abc', '1.5', '999999', null]) expect(parsePage(bad)).toBe(1);
  });

  it('construit les liens de recherche', () => {
    expect(searchQuery({})).toBe('');
    expect(searchQuery({ q: 'relecture de code', tool: 'claude', page: 2 })).toBe(
      '?q=relecture+de+code&tool=claude&page=2',
    );
    expect(searchQuery({ q: 'a&b=c', page: 1 })).toBe('?q=a%26b%3Dc');
    expect(apiBase({ AGENTECA_API_URL: 'http://api:8080/' })).toBe('http://api:8080');
    expect(apiBase({})).toBe('http://localhost:8080');
  });

  it('formate les tailles, les dates et les pluriels dans chaque langue', () => {
    // Intl écrit des espaces insécables, différentes selon les langues : on compare sans en tenir compte.
    const plain = (text: string): string => text.replace(/\s/g, ' ');
    expect(plain(formatSize(512, 'fr'))).toBe('512 octets');
    expect(plain(formatSize(1536, 'fr'))).toBe('1,5 ko');
    expect(plain(formatSize(1536, 'en'))).toBe('1.5 kB');
    expect(plain(formatSize(1, 'en'))).toBe('1 byte');
    expect(formatDate('2026-11-10T21:00:00.000Z', 'fr')).toBe('10 novembre 2026');
    expect(formatDate('2026-11-10T21:00:00.000Z', 'en')).toBe('November 10, 2026');
    expect(formatDate('2026-11-10T21:00:00.000Z', 'zh')).toBe('2026年11月10日');
    const forms = '{0} package|{0} packages';
    expect([0, 1, 2].map((n) => createI18n('en').plural(n, forms))).toEqual([
      '0 packages',
      '1 package',
      '2 packages',
    ]);
    expect([0, 1, 2].map((n) => createI18n('fr').plural(n, forms))).toEqual([
      '0 paquet',
      '1 paquet',
      '2 paquets',
    ]);
    expect(createI18n('zh').plural(3, forms)).toBe('3 个包');
    expect(createI18n('es').t('Page {0} of {1}', [2, 3])).toBe('Página 2 de 3');
    expect(createI18n('hi').t('a text nobody translated')).toBe('a text nobody translated');
  });

  it('choisit la langue : adresse, puis cookie, puis navigateur, puis anglais', () => {
    expect(pickLocale({})).toBe('en');
    expect(pickLocale({ header: 'fr-CH, fr;q=0.9, en;q=0.8' })).toBe('fr');
    expect(pickLocale({ header: 'de;q=0.9, es;q=0.4, hi;q=0.8' })).toBe('hi');
    expect(pickLocale({ header: 'fr;q=0, zh-TW' })).toBe('zh');
    expect(pickLocale({ header: 'fr', cookie: 'es' })).toBe('es');
    expect(pickLocale({ header: 'fr', cookie: 'es', query: 'hi' })).toBe('hi');
    expect(pickLocale({ header: 'fr', cookie: 'xx', query: '../etc' })).toBe('fr');
    expect(negotiateLocale('*')).toBeUndefined();
  });

  it('résume le scan en une phrase', () => {
    const fr = createI18n('fr');
    expect(scanSentence([], false, fr)).toContain('rien relevé');
    const critical = {
      ruleId: 'AHUB-U001',
      severity: 'critical' as const,
      path: 'a',
      line: 1,
      column: 1,
      message: 'm',
    };
    expect(scanSentence([critical], true, fr)).toContain('1 problème critique');
    expect(scanSentence([critical, critical], true, createI18n('en'))).toContain('2 critical problems');
    expect(
      scanSentence(
        [
          { ...critical, severity: 'warning' },
          { ...critical, severity: 'info' },
        ],
        false,
        fr,
      ),
    ).toContain('2 points à vérifier');
  });

  it('calcule le contraste WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5);
  });
});
