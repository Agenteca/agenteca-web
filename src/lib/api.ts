/** Client of the Agenteca Server API (contract: openapi.json of the agenteca-server repository). */

export type Tool = 'claude' | 'codex' | 'copilot' | 'cursor';
export const TOOLS: Tool[] = ['claude', 'codex', 'copilot', 'cursor'];

export interface PackageItem {
  id: number;
  catalog: string;
  name: string;
  source: string;
  repository: string;
  description: string | null;
  license: string | null;
  tools: Tool[];
  tags: string[];
  nativePlugin: boolean;
  latestVersion: string | null;
  status: 'published' | 'pending';
  installCommand: string;
  updatedAt: string;
}

export interface PackagePage {
  items: PackageItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface VersionItem {
  version: string;
  ref: string;
  commit: string | null;
  treeSha256: string | null;
  scanBlocked: boolean;
  findingCount: number;
  indexedAt: string;
}

export interface Finding {
  ruleId: string;
  severity: 'critical' | 'warning' | 'info';
  path: string;
  line: number;
  column: number;
  message: string;
}

export interface VersionDetail extends VersionItem {
  contents: {
    skills: Array<{ name: string; description?: string; files: string[] }>;
    agents: string[];
    commands: string[];
    instructions: string[];
    hooks: Array<{ name: string; events: string[] }>;
    mcpServers: Array<{ name: string; transport?: string; command?: string; args?: string[]; url?: string }>;
  };
  files: Array<{ path: string; size: number; sha256: string; hasContent: boolean }>;
  findings: Finding[];
}

export interface FileContent {
  path: string;
  size: number;
  sha256: string;
  content: string | null;
}

/** Why a call to the catalog failed. Pages turn `reason` into a sentence in the visitor's language. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: 'not_found' | 'unreachable' | 'upstream_error',
    readonly upstreamStatus?: number,
  ) {
    super(`catalog API: ${reason}${upstreamStatus ? ` (${upstreamStatus})` : ''}`);
  }
}

export function apiBase(env: Record<string, string | undefined> = process.env): string {
  return (env.AGENTECA_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
}

async function get<T>(path: string, base = apiBase()): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(502, 'unreachable');
  }
  if (res.status === 404) throw new ApiError(404, 'not_found');
  if (!res.ok) throw new ApiError(502, 'upstream_error', res.status);
  return (await res.json()) as T;
}

export interface SearchParams {
  q?: string;
  tool?: Tool;
  page?: number;
}

export function searchQuery(params: SearchParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.tool) qs.set('tool', params.tool);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const api = {
  search: (params: SearchParams, base?: string): Promise<PackagePage> => {
    const qs = new URLSearchParams({ pageSize: '20' });
    if (params.q) qs.set('q', params.q);
    if (params.tool) qs.set('tool', params.tool);
    if (params.page) qs.set('page', String(params.page));
    return get(`/api/v1/packages?${qs}`, base);
  },
  package: (id: number, base?: string): Promise<PackageItem> => get(`/api/v1/packages/${id}`, base),
  versions: (id: number, base?: string): Promise<{ items: VersionItem[] }> =>
    get(`/api/v1/packages/${id}/versions`, base),
  version: (id: number, version: string, base?: string): Promise<VersionDetail> =>
    get(`/api/v1/packages/${id}/versions/${encodeURIComponent(version)}`, base),
  file: (id: number, version: string, path: string, base?: string): Promise<FileContent> =>
    get(
      `/api/v1/packages/${id}/versions/${encodeURIComponent(version)}/file?path=${encodeURIComponent(path)}`,
      base,
    ),
};
