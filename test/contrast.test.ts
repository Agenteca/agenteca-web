import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../src/lib/format.js';

/** Reads the color tokens of both themes from the style sheet. */
function themes(): { light: Record<string, string>; dark: Record<string, string> } {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const blocks = [...css.matchAll(/:root\s*\{([^}]*)\}/g)].map((m) => {
    const tokens: Record<string, string> = {};
    for (const t of m[1]!.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[t[1]!] = t[2]!;
    return tokens;
  });
  expect(blocks).toHaveLength(2);
  return { light: blocks[0]!, dark: blocks[1]! };
}

// Normal text: 4.5:1 (WCAG 1.4.3). Interface components and focus: 3:1 (WCAG 1.4.11).
const TEXT_PAIRS: Array<[string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'code-bg'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['accent', 'bg'],
  ['accent', 'surface'],
  ['accent-contrast', 'accent'],
  ['danger', 'danger-bg'],
  ['warning', 'warning-bg'],
  ['ok', 'ok-bg'],
];
const UI_PAIRS: Array<[string, string]> = [
  ['control-border', 'bg'],
  ['control-border', 'surface'],
  ['focus', 'bg'],
  ['focus', 'surface'],
];

describe('contrastes WCAG AA', () => {
  for (const [name, tokens] of Object.entries(themes())) {
    it(`${name} theme: text ≥ 4.5:1, components ≥ 3:1`, () => {
      for (const [fg, bg] of TEXT_PAIRS) {
        expect(contrastRatio(tokens[fg]!, tokens[bg]!), `${fg} sur ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const [fg, bg] of UI_PAIRS) {
        expect(contrastRatio(tokens[fg]!, tokens[bg]!), `${fg} sur ${bg}`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  it('both themes define the same tokens', () => {
    const { light, dark } = themes();
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });
});
