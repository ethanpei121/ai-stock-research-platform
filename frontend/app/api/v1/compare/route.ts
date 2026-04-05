import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  return proxyBackend("/api/v1/compare", {
    method: "POST",
    body,
    timeoutMs: 60_000,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
  });
}
