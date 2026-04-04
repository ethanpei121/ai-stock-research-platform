import { Loader2 } from "lucide-react";
import { Suspense } from "react";

import { HomePageClient } from "@/components/HomePageClient";


function HomePageFallback() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-terminal-border bg-terminal-card px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-muted text-accent">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-terminal-text">正在加载</p>
          <p className="mt-0.5 text-xs text-terminal-dim">推荐池与分析面板准备中。</p>
        </div>
      </div>
    </main>
  );
}


export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageClient />
    </Suspense>
  );
}
