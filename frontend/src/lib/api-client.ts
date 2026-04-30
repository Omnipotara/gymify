export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: 'Request failed' } }));

  if (!res.ok) {
    if (res.status === 401) {
      // Notify auth context to clear user state — cookie is HttpOnly so JS can't touch it
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    throw new ApiError(body.error?.code ?? 'UNKNOWN', body.error?.message ?? 'Request failed', res.status);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
