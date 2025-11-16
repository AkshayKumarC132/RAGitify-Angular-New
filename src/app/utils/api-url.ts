const API_BASE = 'http://127.0.0.1:8000/rag';

export function buildUrl(path: string, token: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}${normalized.endsWith('/') ? '' : '/'}${token}/`;
}

export function buildUrlWithId(path: string, token: string, id: string): string {
  const base = buildUrl(path, token);
  return `${base}${id}/`;
}
