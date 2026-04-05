"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { normalizeSymbolInput } from "@/lib/symbols";


export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSymbol = normalizeSymbolInput(searchParams.get("symbol") ?? "");
  const [query, setQuery] = useState(activeSymbol);

  useEffect(() => {
    setQuery(activeSymbol);
  }, [activeSymbol]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextSymbol = normalizeSymbolInput(query);
    if (!nextSymbol) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("symbol", nextSymbol);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-terminal-border bg-terminal-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-dark shadow-glow-sm">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-terminal-text">AI Market Terminal</h1>
          </div>
        </div>

        {/* Search — centered */}
        <form className="flex min-w-0 flex-1 justify-center" onSubmit={handleSubmit}>
          <div className="flex w-full max-w-lg items-center gap-2 rounded-xl border border-terminal-border bg-terminal-card/60 px-3 py-2 transition focus-within:border-accent/30 focus-within:shadow-glow-sm">
            <Search className="h-4 w-4 shrink-0 text-terminal-dim" />
            <label htmlFor="global-symbol-search" className="sr-only">
              搜索股票代码
            </label>
            <input
              id="global-symbol-search"
              value={query}
              maxLength={12}
              placeholder="输入代码搜索，如 AAPL、300750"
              className="terminal-input"
              onChange={(event) => setQuery(event.target.value.toUpperCase())}
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-accent-dark px-3 py-1 text-xs font-semibold text-white transition hover:bg-accent"
            >
              分析
            </button>
          </div>
        </form>

        {/* Right slot */}
        <div className="flex shrink-0 items-center gap-2">
          {activeSymbol ? (
            <span className="terminal-pill-accent">
              {activeSymbol}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
}
