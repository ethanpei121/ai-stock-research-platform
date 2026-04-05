import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  return proxyBackend(`/api/v1/watchlist${request.nextUrl.search}`, {
    timeoutMs: 40_000,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  return proxyBackend("/api/v1/watchlist", {
    method: "POST",
    body,
    timeoutMs: 40_000,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
  });
}
