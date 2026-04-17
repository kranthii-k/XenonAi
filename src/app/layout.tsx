import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Xenon AI — Telemetry",
  description: "Advanced NLP dashboard and telemetry monitoring for product claims.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-[#0A0A0A] text-slate-200 selection:bg-purple-500/30">
        <Sidebar />
        <main className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar relative overflow-x-hidden">
          {children}
        </main>
      </body>
    </html>
  );
}
