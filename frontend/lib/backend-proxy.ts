const FALLBACK_API_TARGET = "http://localhost:8000";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

export const API_TARGET = (process.env.NEXT_PUBLIC_API_BASE ?? FALLBACK_API_TARGET).replace(/\/+$/, "");

function buildBackendUrl(path: string): string {
  return `${API_TARGET}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildProxyErrorResponse(status: number, message: string, details: unknown = null): Response {
  return Response.json(
    {
      error: {
        code: "UPSTREAM_ERROR",
        message,
        details,
      },
    },
    { status }
  );
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
    const contentType = response.headers.get("content-type") ?? JSON_CONTENT_TYPE;

    if (!response.ok) {
      if (contentType.includes("application/json")) {
        return new Response(body, {
          status: response.status,
          headers: {
            "content-type": JSON_CONTENT_TYPE,
          },
        });
      }

      return buildProxyErrorResponse(
        response.status >= 500 ? 502 : response.status,
        response.status >= 500 ? "上游数据源暂时不可用，请稍后重试。" : "请求失败，请稍后重试。",
        { upstream_status: response.status }
      );
    }

    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": contentType,
      },
    });
  } catch {
    return buildProxyErrorResponse(502, "后端服务暂时不可达，请稍后重试。");
  }
}
