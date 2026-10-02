import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Akosile",
  description:
    "Manage money, health, schedule and reminders in one place — online and offline.",
  applicationName: "Akosile",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Akosile",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", display.variable, body.variable, "font-sans")}
    >
      <body className="min-h-full antialiased">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
