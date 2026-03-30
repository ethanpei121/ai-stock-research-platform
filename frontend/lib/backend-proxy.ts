const FALLBACK_API_TARGET = "http://localhost:8000";

export const API_TARGET = (process.env.NEXT_PUBLIC_API_BASE ?? FALLBACK_API_TARGET).replace(/\/+$/, "");

function buildBackendUrl(path: string): string {
  return `${API_TARGET}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function proxyBackend(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await fetch(buildBackendUrl(path), {
      ...init,
      headers,
      cache: "no-store",
    });
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "application/json; charset=utf-8";
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch {
    return Response.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "后端服务暂时不可达，请稍后重试。",
          details: null,
        },
      },
      { status: 502 }
    );
  }
}
