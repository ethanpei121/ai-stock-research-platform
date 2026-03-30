import { Loader2 } from "lucide-react";
import { Suspense } from "react";

import { HomePageClient } from "@/components/HomePageClient";


function HomePageFallback() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md items-center gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-slate-900/5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">正在加载市场工作台</p>
          <p className="mt-1 text-sm text-slate-500">推荐池、搜索入口与分析面板正在准备中。</p>
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
