import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ginkgo — Distillation Engine for AI",
  description: "治療 AI 失憶症的蒸餾引擎。把對話提煉成可演化的 Project Brain，下次開新對話直接注入。",
  keywords: ["Ginkgo", "AI memory", "distillation", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui"],
  authors: [{ name: "Ginkgo" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Ginkgo",
    description: "Distillation Engine for AI — 治療 AI 失憶症",
    url: "https://chat.z.ai",
    siteName: "Ginkgo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ginkgo",
    description: "Distillation Engine for AI — 治療 AI 失憶症",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
