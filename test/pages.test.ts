import axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { type ChildProcess, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Lance le site construit (dist/) face à une fausse API, puis vérifie le HTML
 * servi : contenu, comportement sans JavaScript et règles d'accessibilité axe.
 * Le contraste, que jsdom ne sait pas calculer, est couvert par contrast.test.ts.
 */
const ENTRY = fileURLToPath(new URL('../dist/server/entry.mjs', import.meta.url));
const hidden = [...'x'].map((c) => String.fromCodePoint(0xe0000 + c.charCodeAt(0))).join('');

const PACKAGES = [
  {
    id: 1,
    catalog: 'default',
    name: 'code-review',
    source: 'acme/code-review#v1.2.0',
    repository: 'acme/code-review',
    description: 'Relecture de code assistée',
    license: 'Apache-2.0',
    tools: ['claude', 'cursor'],
    tags: ['qualité'],
    nativePlugin: false,
    latestVersion: '1.2.0',
    status: 'published',
    installCommand: 'ahub add acme/code-review#v1.2.0',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 2,
    catalog: 'default',
    name: 'piege',
    source: 'acme/piege',
    repository: 'acme/piege',
    description: null,
    license: null,
    tools: ['codex'],
    tags: [],
    nativePlugin: false,
    latestVersion: 'main',
    status: 'published',
    installCommand: 'ahub add acme/piege',
    updatedAt: '2026-11-10T10:00:00.000Z',
  },
];
const version = (v: string, blocked = false) => ({
  version: v,
  ref: v === 'main' ? 'main' : `v${v}`,
  commit: 'a'.repeat(40),
  treeSha256: `sha256:${'b'.repeat(64)}`,
  scanBlocked: blocked,
  findingCount: blocked ? 1 : 0,
  indexedAt: '2026-11-10T10:00:00.000Z',
});
const DETAIL = {
  ...version('1.2.0'),
  contents: {
    skills: [{ name: 'review', description: 'Relit une modification.', files: ['SKILL.md'] }],
    agents: ['reviewer'],
    commands: ['summarize'],
    instructions: ['style'],
    hooks: [{ name: 'notify', events: ['Stop'] }],
    mcpServers: [{ name: 'tracker', transport: 'stdio', command: 'npx', args: ['-y', '@acme/tracker'] }],
  },
  files: [
    { path: '.apm/skills/review/SKILL.md', size: 120, sha256: 'c'.repeat(64), hasContent: true },
    { path: 'logo.png', size: 2048, sha256: 'd'.repeat(64), hasContent: false },
  ],
  findings: [],
};
const FILE_TEXT = '---\nname: review\n---\n\n<script>alert("xss")</script> & <b>gras</b>\n';

let api: Server;
let web: ChildProcess;
let base = '';
let apiDown = false;

function mockApi(): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const send = (status: number, body: unknown): void => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (apiDown) return send(500, { error: { code: 'INTERNAL', message: 'panne' } });
    const p = url.pathname;
    if (p === '/api/v1/packages') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const tool = url.searchParams.get('tool');
      const page = Number(url.searchParams.get('page') ?? 1);
      if (q === 'beaucoup') return send(200, { items: [PACKAGES[0]], total: 45, page, pageSize: 20 });
      const items = PACKAGES.filter(
        (x) =>
          (!q || `${x.name} ${x.description ?? ''}`.toLowerCase().includes(q)) &&
          (!tool || x.tools.includes(tool)),
      );
      return send(200, { items, total: items.length, page, pageSize: 20 });
    }
    if (p === '/api/v1/packages/1') return send(200, PACKAGES[0]);
    if (p === '/api/v1/packages/1/versions')
      return send(200, { items: [version('1.2.0'), version('1.1.0')] });
    if (p === '/api/v1/packages/1/versions/1.2.0') return send(200, DETAIL);
    if (p === '/api/v1/packages/1/versions/1.1.0') return send(200, { ...DETAIL, ...version('1.1.0') });
    if (p === '/api/v1/packages/1/versions/1.2.0/file')
      return send(200, {
        path: url.searchParams.get('path'),
        size: 120,
        sha256: 'c'.repeat(64),
        content: FILE_TEXT,
      });
    if (p === '/api/v1/packages/2') return send(200, PACKAGES[1]);
    if (p === '/api/v1/packages/2/versions') return send(200, { items: [version('main', true)] });
    if (p === '/api/v1/packages/2/versions/main') {
      return send(200, {
        ...version('main', true),
        contents: { skills: [], agents: ['a'], commands: [], instructions: [], hooks: [], mcpServers: [] },
        files: [{ path: '.apm/agents/a.agent.md', size: 10, sha256: 'e'.repeat(64), hasContent: true }],
        findings: [
          {
            ruleId: 'AHUB-U001',
            severity: 'critical',
            path: '.apm/agents/a.agent.md',
            line: 4,
            column: 7,
            message: `Caractères invisibles ${hidden}`,
          },
        ],
      });
    }
    return send(404, { error: { code: 'NOT_FOUND', message: 'introuvable' } });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function page(path: string): Promise<{ status: number; html: string; doc: Document; dom: JSDOM }> {
  const res = await fetch(`${base}${path}`);
  const html = await res.text();
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: `${base}${path}` });
  return { status: res.status, html, doc: dom.window.document, dom };
}

async function a11y(dom: JSDOM): Promise<string[]> {
  dom.window.eval(axe.source);
  const results = await (dom.window as unknown as { axe: typeof axe }).axe.run(dom.window.document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (v) => `${v.id} : ${v.help} (${v.nodes.length} élément(s) — ${v.nodes[0]?.html.slice(0, 120)})`,
  );
}

beforeAll(async () => {
  if (!existsSync(ENTRY))
    throw new Error('dist/ absent : lancez « npm run build » (ou « npm test », qui le fait).');
  api = await mockApi();
  const probe = createServer();
  await new Promise<void>((r) => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as AddressInfo).port;
  await new Promise((r) => probe.close(r));
  web = spawn(process.execPath, [ENTRY], {
    env: {
      PATH: process.env.PATH,
      HOST: '127.0.0.1',
      PORT: String(port),
      AGENTECA_API_URL: `http://127.0.0.1:${(api.address() as AddressInfo).port}`,
    },
    stdio: 'ignore',
  });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error('le site ne démarre pas');
});

afterAll(async () => {
  web?.kill();
  await new Promise((r) => api?.close(r));
});

describe('page catalogue', () => {
  it('liste les paquets avec un formulaire utilisable sans JavaScript', async () => {
    const { status, doc, dom } = await page('/');
    expect(status).toBe(200);
    expect(doc.documentElement.lang).toBe('fr');
    expect(doc.title).toBe('Catalogue — Agenteca');
    expect(doc.querySelector('h1')!.textContent).toBe('Catalogue d’agents');
    const form = doc.querySelector('form[role="search"]')!;
    expect(form.getAttribute('method')).toBe('get');
    expect(doc.querySelector('label[for="q"]')).not.toBeNull();
    expect([...doc.querySelectorAll('input[name="tool"]')].map((i) => (i as HTMLInputElement).value)).toEqual(
      ['', 'claude', 'codex', 'copilot', 'cursor'],
    );
    expect(doc.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('2 paquets');
    expect(
      [...doc.querySelectorAll('.card h3 a')].map((a) => [a.textContent, a.getAttribute('href')]),
    ).toEqual([
      ['code-review', '/packages/1'],
      ['piege', '/packages/2'],
    ]);
    expect(doc.querySelector('.skip-link')!.getAttribute('href')).toBe('#contenu');
    expect(await a11y(dom)).toEqual([]);
  });

  it('filtre par mots et par outil, et garde les choix dans le formulaire', async () => {
    const { doc, dom } = await page('/?q=relecture&tool=cursor');
    expect((doc.getElementById('q') as HTMLInputElement).value).toBe('relecture');
    expect((doc.querySelector('input[name="tool"][value="cursor"]') as HTMLInputElement).checked).toBe(true);
    expect(doc.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      '1 paquet pour cette recherche',
    );
    expect(doc.querySelectorAll('.card')).toHaveLength(1);
    expect(await a11y(dom)).toEqual([]);
    // Un outil inconnu dans l'URL est ignoré plutôt que transmis.
    expect((await page('/?tool=emacs')).doc.querySelectorAll('.card')).toHaveLength(2);
  });

  it('explique une recherche sans résultat et pagine les longues listes', async () => {
    const empty = await page('/?q=introuvable');
    expect(empty.doc.querySelector('[role="status"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
      'Aucun paquet trouvé',
    );
    expect(empty.doc.querySelector('main a[href="/"]')).not.toBeNull();
    expect(await a11y(empty.dom)).toEqual([]);

    const paged = await page('/?q=beaucoup&page=2');
    const nav = paged.doc.querySelector('nav[aria-label="Pages de résultats"]')!;
    expect(nav.textContent!.replace(/\s+/g, ' ')).toContain('Page 2 sur 3');
    expect(nav.querySelector('a[rel="prev"]')!.getAttribute('href')).toBe('/?q=beaucoup');
    expect(nav.querySelector('a[rel="next"]')!.getAttribute('href')).toBe('/?q=beaucoup&page=3');
    expect(await a11y(paged.dom)).toEqual([]);
  });

  it('échappe la saisie de l’utilisateur', async () => {
    const { html, doc } = await page(`/?q=${encodeURIComponent('"><script>alert(1)</script>')}`);
    // La saisie revient dans le champ telle quelle, sans créer d'élément : aucune balise script injectée.
    expect((doc.getElementById('q') as HTMLInputElement).value).toBe('"><script>alert(1)</script>');
    expect([...doc.querySelectorAll('script')].filter((s) => s.textContent?.includes('alert(1)'))).toEqual(
      [],
    );
    expect(html).toContain(
      '<title>Recherche : &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; — Agenteca</title>',
    );
  });
});

describe('page paquet', () => {
  it('montre la commande, le contenu et les éléments exécutables avant installation', async () => {
    const { status, doc, dom } = await page('/packages/1');
    expect(status).toBe(200);
    expect(doc.querySelector('h1')!.textContent).toBe('code-review');
    expect(doc.getElementById('commande')!.textContent).toBe('ahub add acme/code-review#v1.2.0');
    // Le bouton de copie n'apparaît qu'avec JavaScript ; sans lui, la commande reste lisible.
    const button = doc.querySelector('button[data-copy="commande"]') as HTMLButtonElement;
    expect(button.hidden).toBe(true);
    expect(button.textContent!.trim()).toBe('Copier la commande');
    expect(doc.querySelector('[data-copy-status]')!.getAttribute('aria-live')).toBe('polite');

    const text = doc.querySelector('main')!.textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('Rien à signaler.');
    expect(text).toContain('Ce paquet lance des programmes. 2 éléments ci-dessous exécutent une commande');
    expect(text).toContain('review — Relit une modification.');
    expect(text).toContain('npx -y @acme/tracker');
    expect(text).toContain('fichier binaire non affiché');
    expect([...doc.querySelectorAll('h2')].map((h) => h.textContent!.trim())).toEqual([
      'Installer',
      'Contrôle de sécurité',
      'Ce que ce paquet installe',
      'Lire les fichiers (2)',
      'Détails',
    ]);
    expect(await a11y(dom)).toEqual([]);
  });

  it('affiche le texte d’un fichier, échappé', async () => {
    const { html, doc, dom } = await page(
      `/packages/1?version=1.2.0&file=${encodeURIComponent('.apm/skills/review/SKILL.md')}`,
    );
    const pre = doc.querySelector('#fichier pre')!;
    expect(pre.textContent).toBe(FILE_TEXT);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(doc.querySelector('a[aria-current="true"]')!.textContent!.trim()).toBe(
      '.apm/skills/review/SKILL.md',
    );
    expect(await a11y(dom)).toEqual([]);
    // Un fichier absent de la liste n'est pas demandé à l'API.
    expect((await page('/packages/1?file=../../etc/passwd')).doc.getElementById('fichier')).toBeNull();
  });

  it('adapte la commande à une version plus ancienne', async () => {
    const { doc } = await page('/packages/1?version=1.1.0');
    expect(doc.getElementById('commande')!.textContent).toBe('ahub add acme/code-review#v1.1.0');
    expect(doc.getElementById('titre-installer')!.textContent).toBe('Installer la version 1.1.0');
  });

  it('met en avant un problème critique', async () => {
    const { doc, dom } = await page('/packages/2');
    const notice = doc.querySelector('.notice.danger')!;
    expect(notice.textContent!.replace(/\s+/g, ' ')).toContain(
      'Attention. Le contrôle automatique a relevé 1 problème critique',
    );
    const row = doc.querySelector('tbody tr')!;
    expect(row.textContent!.replace(/\s+/g, ' ')).toContain('Critique');
    expect(row.querySelector('a')!.getAttribute('href')).toContain('file=.apm%2Fagents%2Fa.agent.md');
    expect(doc.querySelector('table caption')).not.toBeNull();
    expect(await a11y(dom)).toEqual([]);
  });

  it('répond 404 pour un paquet inconnu ou un identifiant invalide', async () => {
    for (const path of ['/packages/999', '/packages/abc', '/packages/-1']) {
      const { status, doc, dom } = await page(path);
      expect(status, path).toBe(404);
      expect(doc.querySelector('h1')!.textContent).toBe('Paquet introuvable');
      expect(doc.querySelector('[role="alert"]')).not.toBeNull();
      expect(await a11y(dom)).toEqual([]);
    }
    expect((await page('/nulle-part')).status).toBe(404);
  });
});

describe('panne du catalogue', () => {
  it('répond 502 avec un message clair, sans page blanche', async () => {
    apiDown = true;
    try {
      const home = await page('/');
      expect(home.status).toBe(502);
      expect(home.doc.querySelector('[role="alert"]')!.textContent).toContain('Réessayez dans un instant');
      expect(home.doc.querySelector('form[role="search"]')).not.toBeNull();
      const pkg = await page('/packages/1');
      expect(pkg.status).toBe(502);
      expect(pkg.doc.querySelector('h1')!.textContent).toBe('Catalogue injoignable');
      expect(await a11y(home.dom)).toEqual([]);
    } finally {
      apiDown = false;
    }
  });
});
