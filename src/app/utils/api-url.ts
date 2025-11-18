const API_BASE = 'http://127.0.0.1:8000/rag';

function trimSlashes(segment: string): string {
  return segment.replace(/^\/+|\/+$/g, '');
}

export function buildPublicUrl(path: string): string {
  const normalized = trimSlashes(path);
  return `${API_BASE}/${normalized}/`;
}

export function buildTokenUrl(path: string, token: string, ...segments: (string | number)[]): string {
  const base = trimSlashes(path);
  const encodedToken = encodeURIComponent(token);
  const parts = [base, encodedToken, ...segments.map(segment => trimSlashes(String(segment)))].filter(Boolean);
  return `${API_BASE}/${parts.join('/')}/`;
}

export function buildTokenUrlWithId(path: string, token: string, id: string | number, ...segments: (string | number)[]): string {
  return buildTokenUrl(path, token, id, ...segments);
}

export { API_BASE };
