export type HealthResponse = {
  status: string;
};


export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000").replace(
  /\/+$/,
  ""
);


function buildUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}


export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    cache: "no-store"
  });

  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    const responseText = await response.text();
    throw new Error(responseText || fallbackMessage);
  }

  return (await response.json()) as T;
}


export function checkBackendHealth(): Promise<HealthResponse> {
  return fetchJson<HealthResponse>("/health");
}
