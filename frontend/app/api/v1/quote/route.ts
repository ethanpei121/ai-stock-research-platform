import { NextRequest } from "next/server";

import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return proxyBackend(`/api/v1/quote${request.nextUrl.search}`);
}
