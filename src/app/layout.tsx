import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthProvider } from "@/features/auth/components/session-provider";
import { SignIn } from "@/features/auth/components/sign-in";
import { ThemeToggle } from "@/components/theme-toggle";
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
  description: "A pollinator RPG based in Pittsburgh, PA",
};

const navItems = [
  { href: "/play", label: "Play" },
  { href: "/about", label: "About" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint. Without it, somebody who has chosen dark gets
            a full white page for one frame on every navigation, which is the one
            thing a dark mode exists to prevent. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('scout-theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`,
          }}
        />
      </head>
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
                <ThemeToggle />
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
              <span>A pollinator RPG based in Pittsburgh, PA</span>
              <span className="site-footer__links">
                <a
                  href="https://www.3sb.io/"
                  rel="noreferrer"
                  target="_blank"
                >
                  A 3sb Original
                </a>
                <Link href="/credits">Credits &amp; licences</Link>
              </span>
            </div>
          </footer>
        </div>
        </AuthProvider>
        {/* Vercel Analytics: first-party, no third-party script, no cookies, and
            therefore no consent banner. It counts page views and Web Vitals and
            nothing else. It cannot follow anybody around the internet, which is
            the right amount of tracking for a game about bees. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
