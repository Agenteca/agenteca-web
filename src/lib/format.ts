import { ApiError, type Finding, type Tool } from './api.js';
import { HTML_LANG, type I18n, type Locale } from './i18n.js';

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

/** "512 bytes", "1.5 kB", "2.3 MB", written the way the visitor's language writes them. */
export function formatSize(bytes: number, locale: Locale): string {
  const unit = (value: number, name: string, display: 'short' | 'long'): string =>
    new Intl.NumberFormat(HTML_LANG[locale], {
      style: 'unit',
      unit: name,
      unitDisplay: display,
      maximumFractionDigits: 1,
    }).format(value);
  if (bytes < 1024) return unit(bytes, 'byte', 'long');
  if (bytes < 1024 * 1024) return unit(bytes / 1024, 'kilobyte', 'short');
  return unit(bytes / 1024 / 1024, 'megabyte', 'short');
}

export function formatDate(iso: string, locale: Locale): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat(HTML_LANG[locale], { dateStyle: 'long', timeZone: 'UTC' }).format(d);
}

export function severityLabel(severity: Finding['severity'], { t }: I18n): string {
  if (severity === 'critical') return t('Critical');
  if (severity === 'warning') return t('Warning');
  return t('Information');
}

/** The scan summed up in one sentence, for a reader who is not a specialist. */
export function scanSentence(findings: Finding[], blocked: boolean, { t, plural }: I18n): string {
  if (findings.length === 0) return t('The automatic check found nothing in this version.');
  const critical = findings.filter((f) => f.severity === 'critical').length;
  if (blocked) {
    return plural(
      critical,
      'The automatic check found {0} critical problem: ahub refuses to install this version without explicit agreement.|The automatic check found {0} critical problems: ahub refuses to install this version without explicit agreement.',
    );
  }
  return plural(
    findings.length,
    'The automatic check found {0} point to check before installing.|The automatic check found {0} points to check before installing.',
  );
}

/** What to tell the visitor when the catalog could not answer. */
export function failureSentence(error: unknown, { t }: I18n): string {
  if (error instanceof ApiError && error.reason === 'unreachable')
    return t('The catalog is temporarily unreachable.');
  if (error instanceof ApiError && error.reason === 'upstream_error')
    return t('The catalog answered with an error ({0}).', [error.upstreamStatus ?? error.status]);
  return t('Something went wrong.');
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string): number => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) throw new Error(`invalid color: ${hex}`);
    const [r, g, bl] = [0, 2, 4].map((i) => {
      const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
