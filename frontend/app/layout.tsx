import type { Metadata } from "next";

import "./globals.css";


export const metadata: Metadata = {
  title: "AI Stock Research Platform",
  description: "Deploy-ready Next.js frontend for the AI Stock Research Platform."
};


export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
