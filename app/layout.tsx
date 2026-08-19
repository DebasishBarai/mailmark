export const dynamic = "force-dynamic";

import type { Metadata } from "next";
// Old fonts: Geist Sans / Geist Mono
// import { GeistSans } from "geist/font/sans";
// import { GeistMono } from "geist/font/mono";
import { Fraunces, Schibsted_Grotesk, DM_Mono } from "next/font/google";
import { Suspense } from "react";
import ConvexClientProvider from "./components/ConvexClientProvider";
import ThemeProvider from "./components/ThemeProvider";
import ClerkThemeProvider from "./components/ClerkThemeProvider";
import PreferenceSync from "./components/PreferenceSync";
import RefCapture from "./components/RefCapture";
import "./globals.css";

// const geistSans = GeistSans;
// const geistMono = GeistMono;

// Editorial type stack from the landing page design.
// Fraunces is the display serif (headlines), Schibsted Grotesk the UI sans,
// DM Mono the monospace face for labels and code.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
});

const schibstedGrotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-schibsted-grotesk",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.mailmark.dev"),
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
    url: "https://www.mailmark.dev",
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
      {/* Old: className={`${geistSans.variable} ${geistMono.variable} antialiased`} */}
      <body
        className={`${schibstedGrotesk.variable} ${fraunces.variable} ${dmMono.variable} antialiased`}
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
