import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  return proxyBackend(`/api/v1/announcements${request.nextUrl.search}`, {
    timeoutMs: 45_000,
  });
}
