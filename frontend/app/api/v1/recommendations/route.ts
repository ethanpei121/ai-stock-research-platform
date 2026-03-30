import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return proxyBackend("/api/v1/recommendations");
}
