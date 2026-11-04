import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito } from "next/font/google";
import "./globals.css";

const display = Baloo_2({ subsets: ["latin"], variable: "--font-display" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Family Board",
  description: "The family schedule, chores and rewards board",
  manifest: "/manifest-parent.webmanifest",
  applicationName: "Family Board",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Family Board",
  },
  icons: {
    icon: [{ url: "/icon-parent.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-parent.svg" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#8b5cf6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
