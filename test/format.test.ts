import { describe, expect, it } from 'vitest';
import { apiBase, searchQuery } from '../src/lib/api.js';
import {
  contrastRatio,
  formatDate,
  formatSize,
  parsePage,
  parseTool,
  plural,
  scanSentence,
} from '../src/lib/format.js';

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

  it('formate en français', () => {
    expect(plural(1, 'paquet')).toBe('1 paquet');
    expect(plural(2, 'paquet')).toBe('2 paquets');
    expect(plural(0, 'paquet')).toBe('0 paquet');
    expect(formatSize(512)).toBe('512 octets');
    expect(formatSize(1536)).toBe('1,5 Ko');
    expect(formatDate('2026-11-10T21:00:00.000Z')).toBe('10 novembre 2026');
  });

  it('résume le scan en une phrase', () => {
    expect(scanSentence([], false)).toContain('rien relevé');
    const critical = {
      ruleId: 'AHUB-U001',
      severity: 'critical' as const,
      path: 'a',
      line: 1,
      column: 1,
      message: 'm',
    };
    expect(scanSentence([critical], true)).toContain('1 problème critique');
    expect(
      scanSentence(
        [
          { ...critical, severity: 'warning' },
          { ...critical, severity: 'info' },
        ],
        false,
      ),
    ).toContain('2 points à vérifier');
  });

  it('calcule le contraste WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThan(4.5);
  });
});
