import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School-X 교사연구회 AI Office",
  description: "School-X 교사연구회용 AI 협업 사무실",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="flex min-h-dvh flex-col text-ink">{children}</body>
    </html>
  );
}
