import type { Metadata } from "next";

import "./globals.css";


export const metadata: Metadata = {
  title: "AI Stock Research Platform",
  description: "A demo-ready stock quote, news, and AI summary dashboard built with Next.js and FastAPI.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
