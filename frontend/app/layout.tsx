import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/AppHeader";

import "./globals.css";


export const metadata: Metadata = {
  title: "AI Market Terminal — 智能投研平台",
  description: "实时股票行情、AI 投研简报、推荐股票池。支持 A 股与美股的行情聚合、新闻追踪和多维度评分分析。",
};


function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-terminal-border bg-terminal-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <div className="h-6 w-36 animate-pulse rounded-lg bg-terminal-card" />
        <div className="h-9 w-full max-w-md animate-pulse rounded-xl bg-terminal-card" />
      </div>
    </header>
  );
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-terminal-bg font-sans text-terminal-text antialiased">
        <div className="min-h-screen bg-grid-pattern bg-grid bg-terminal-bg/95">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.08),transparent_50%)]" />
          <div className="relative">
            <Suspense fallback={<HeaderFallback />}>
              <AppHeader />
            </Suspense>
            <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
