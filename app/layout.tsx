export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Suspense } from "react";
import ConvexClientProvider from "./components/ConvexClientProvider";
import ThemeProvider from "./components/ThemeProvider";
import ClerkThemeProvider from "./components/ClerkThemeProvider";
import PreferenceSync from "./components/PreferenceSync";
import RefCapture from "./components/RefCapture";
import "./globals.css";

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  metadataBase: new URL("https://mailmark.dev"),
  title: {
    default: "Mailmark - Email Hosting & Campaigns for Your Domain",
    template: "%s | Mailmark",
  },
  description:
    "Add your domain, create unlimited mailboxes, and run powerful email campaigns. A complete email platform with inbox, sent, outbox, and built-in campaign tools.",
  openGraph: {
    type: "website",
    siteName: "Mailmark",
    title: "Mailmark - Email Hosting & Campaigns for Your Domain",
    description:
      "Add your domain, create unlimited mailboxes, and run powerful email campaigns. A complete email platform with inbox, sent, outbox, and built-in campaign tools.",
    url: "https://mailmark.dev",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Mailmark" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mailmark - Email Hosting & Campaigns for Your Domain",
    description:
      "Add your domain, create unlimited mailboxes, and run powerful email campaigns. A complete email platform with inbox, sent, outbox, and built-in campaign tools.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
    apple: { url: "/icon-192.png", sizes: "192x192" },
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <ClerkThemeProvider>
            <ConvexClientProvider>
              <PreferenceSync />
              <Suspense fallback={null}><RefCapture /></Suspense>
              {children}
            </ConvexClientProvider>
          </ClerkThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
