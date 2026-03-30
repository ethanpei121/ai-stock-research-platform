import { Suspense } from "react";

import { HomePageClient } from "@/components/HomePageClient";


function HomePageFallback() {
  return (
    <main className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-8 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <div className="h-28 rounded-lg border border-slate-200 bg-white shadow-sm" />
          <div className="h-28 rounded-lg border border-slate-200 bg-white shadow-sm" />
          <div className="h-28 rounded-lg border border-slate-200 bg-white shadow-sm sm:col-span-2 xl:col-span-1" />
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-72 animate-pulse rounded bg-slate-100" />
      </section>
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
