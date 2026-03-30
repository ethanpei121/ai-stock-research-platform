import type { Metadata } from "next";
import { Suspense } from "react";

import { AppHeader } from "@/components/AppHeader";

import "./globals.css";


export const metadata: Metadata = {
  title: "AI Market Terminal",
  description: "Enterprise-style market dashboard for equity recommendations and AI-backed stock analysis.",
};


function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/90 px-4 py-4 shadow-sm ring-1 ring-slate-900/5 sm:px-5">
          <div className="h-10 w-52 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-11 w-full max-w-lg animate-pulse rounded-xl bg-slate-100" />
        </div>
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
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.10),transparent_22%),linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:auto,28px_28px,28px_28px]">
          <Suspense fallback={<HeaderFallback />}>
            <AppHeader />
          </Suspense>
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
