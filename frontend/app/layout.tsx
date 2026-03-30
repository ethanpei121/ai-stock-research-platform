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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="h-10 w-48 animate-pulse rounded bg-slate-100" />
        <div className="h-10 w-full max-w-md animate-pulse rounded bg-slate-100" />
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
        <div className="min-h-screen bg-slate-50">
          <Suspense fallback={<HeaderFallback />}>
            <AppHeader />
          </Suspense>
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </body>
    </html>
  );
}
