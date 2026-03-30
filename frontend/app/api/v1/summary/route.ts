import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.text();
  return proxyBackend("/api/v1/summary", {
    method: "POST",
    body,
    headers: {
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
  });
}
