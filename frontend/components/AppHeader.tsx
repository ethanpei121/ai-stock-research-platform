"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}


export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSymbol = searchParams.get("symbol") ?? "";
  const [query, setQuery] = useState(activeSymbol);

  useEffect(() => {
    setQuery(activeSymbol);
  }, [activeSymbol]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSymbol = normalizeSymbol(query);
    if (!nextSymbol) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("symbol", nextSymbol);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs font-semibold tracking-[0.18em] text-slate-700">
              AM
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Market Intelligence</p>
              <h1 className="text-base font-semibold text-slate-900 sm:text-lg">AI Market Terminal</h1>
            </div>
          </div>
        </div>

        <form className="flex w-full max-w-md items-center gap-2" onSubmit={handleSubmit}>
          <label htmlFor="global-symbol-search" className="sr-only">
            Search stock symbol
          </label>
          <div className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              id="global-symbol-search"
              value={query}
              maxLength={12}
              placeholder="搜索代码，例如 AAPL 或 300750"
              className="w-full border-0 bg-transparent font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400"
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            分析
          </button>
        </form>
      </div>
    </header>
  );
}
