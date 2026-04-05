import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

type RouteContext = {
  params: Promise<{ symbol: string }>;
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function DELETE(request: NextRequest, context: RouteContext): Promise<Response> {
  const { symbol } = await context.params;
  return proxyBackend(`/api/v1/watchlist/${encodeURIComponent(symbol)}${request.nextUrl.search}`, {
    method: "DELETE",
    timeoutMs: 40_000,
  });
}
