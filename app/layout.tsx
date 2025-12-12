import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import Navbar from "@/components/navbar";
import { TestModeBanner } from "@/components/TestModeBanner";
import { buildMetadata } from "@/lib/metadata";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = buildMetadata({});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Navbar />
        <main className="min-h-screen bg-background">
          <TestModeBanner />
          {children}
        </main>
      </body>
    </html>
  );
}
