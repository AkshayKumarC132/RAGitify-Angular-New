const API_BASE = 'https://rag.xamplify.co/rag';

export function buildUrl(path: string, token: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}${normalized.endsWith('/') ? '' : '/'}${token}/`;
}

export function buildUrlWithId(path: string, token: string, id: string): string {
  const base = buildUrl(path, token);
  return `${base}${id}/`;
}
