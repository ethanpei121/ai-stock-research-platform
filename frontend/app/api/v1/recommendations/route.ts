import { proxyBackend } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  return proxyBackend("/api/v1/recommendations", {
    timeoutMs: 55_000,
  });
}
