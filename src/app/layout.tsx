import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import DemoModeBanner from "./components/DemoModeBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pipeline - Sales Opportunity Management",
  description: "Manage your sales pipeline with real-time Kanban boards and analytics",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const demoModeEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased transition-colors duration-300 bg-white dark:bg-slate-950 text-black dark:text-white`}
      >
        <ThemeProvider>
          <DemoModeBanner enabled={demoModeEnabled} />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
