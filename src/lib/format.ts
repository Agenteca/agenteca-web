import type { Finding, Tool } from './api.js';

export const TOOL_LABELS: Record<Tool, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  copilot: 'GitHub Copilot',
  cursor: 'Cursor',
};

export function parseTool(value: string | null): Tool | undefined {
  return value && value in TOOL_LABELS ? (value as Tool) : undefined;
}

export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n > 1 ? pluralForm : singular}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} octets`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(d);
}

export const SEVERITY_LABELS: Record<Finding['severity'], string> = {
  critical: 'Critique',
  warning: 'Avertissement',
  info: 'Information',
};

/** Résumé du scan en une phrase, pour un lecteur non technicien. */
export function scanSentence(findings: Finding[], blocked: boolean): string {
  if (findings.length === 0) return 'Le contrôle automatique n’a rien relevé dans cette version.';
  const critical = findings.filter((f) => f.severity === 'critical').length;
  if (blocked) {
    return `Le contrôle automatique a relevé ${plural(critical, 'problème critique', 'problèmes critiques')} : ahub refuse d’installer cette version sans accord explicite.`;
  }
  return `Le contrôle automatique a relevé ${plural(findings.length, 'point')} à vérifier avant d’installer.`;
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) throw new Error(`couleur invalide : ${hex}`);
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
