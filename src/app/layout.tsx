import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Practice Lab",
  description: "Local RAG playground: ingest, retrieve, chat, summarize (Next.js + Supabase pgvector).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
