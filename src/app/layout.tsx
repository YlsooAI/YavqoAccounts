import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import LanguageSelector from "@/components/LanguageSelector";

export const metadata: Metadata = {
  title: "Yavqo Account",
  description:
    "Manage your Yavqo Account — security, privacy, and personal info in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}<Suspense fallback={null}><LanguageSelector /></Suspense></body>
    </html>
  );
}
