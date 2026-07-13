import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthProvider } from "@/features/auth/components/session-provider";
import { SignIn } from "@/features/auth/components/sign-in";
import { authConfigured } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Scout",
    template: "%s | Scout",
  },
  description:
    "A desktop-first pollinator RPG set in a simplified Frick Park.",
};

const navItems = [
  { href: "/play", label: "Play" },
  { href: "/offline", label: "Offline" },
  { href: "/customize", label: "Customize" },
  { href: "/journal", label: "Journal" },
  { href: "/profile", label: "Profile" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="app-shell">
          <header className="site-header">
            <div className="site-header__inner">
              <Link className="brand" href="/" aria-label="Scout home">
                <span className="brand__mark" aria-hidden="true">
                  S
                </span>
                <span>Scout</span>
              </Link>
              <nav className="site-nav" aria-label="Primary navigation">
                {navItems.map((item) => (
                  <Link href={item.href} key={item.href}>
                    {item.label}
                  </Link>
                ))}
                {/* Renders nothing at all when Google isn't configured. */}
                <SignIn configured={authConfigured} />
              </nav>
            </div>
          </header>
          {/* A div, not a <main>. Every page renders its own <main>, and nesting two
              of them is invalid HTML and gives a screen reader two conflicting
              "main" landmarks to choose between. */}
          <div className="main-content" id="main">
            {children}
          </div>
          <footer className="site-footer">
            <div className="site-footer__inner">
              <span>
                A pollinator RPG set in Frick Park, Pittsburgh.
              </span>
              <Link href="/credits">Credits &amp; licences</Link>
            </div>
          </footer>
        </div>
        </AuthProvider>
        {/* Vercel Analytics: first-party, no third-party script, no cookies, and
            therefore no consent banner. It counts page views and Web Vitals and
            nothing else — it cannot follow anybody around the internet, which is
            the right amount of tracking for a game about bees. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
