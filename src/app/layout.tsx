import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AuthProvider } from "@/features/auth/components/session-provider";
import { ChooseUsername } from "@/features/auth/components/choose-username";
import { SignIn } from "@/features/auth/components/sign-in";
import { NavMenu, type NavItem } from "@/components/nav-menu";
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

/**
 * What stays out on the bar.
 *
 * The two things you came to do, and the place everything you have found lives.
 * Parties sits next to Play because it is the same verb with other people in it,
 * and a lobby nobody can find from the nav is a lobby nobody joins.
 */
const navItems = [
  { href: "/play", label: "Play" },
  { href: "/parties", label: "Parties" },
];

/**
 * And what folds away behind one button.
 *
 * Settings and reading, in that order: the things you change about your own bee
 * first, then the things you read once. None of them is something you reach for
 * mid-session, which is the test for whether a link has earned a place on the
 * bar.
 */
const moreItems: NavItem[] = [
  { kind: "link", href: "/pocket", label: "Pocket" },
  { kind: "link", href: "/journal", label: "Journal" },
  { kind: "link", href: "/customize", label: "Customize" },
  { kind: "link", href: "/offline", label: "Offline run" },
  { kind: "link", href: "/about", label: "About" },
  { kind: "link", href: "/credits", label: "Credits" },
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
                <NavMenu items={moreItems} label="More" />
                {/* Renders nothing at all when Google isn't configured. */}
                <SignIn configured={authConfigured} />
                <ThemeToggle />
              </nav>
            </div>
          </header>
          {/* Asked once of anybody signed in who has not chosen a name, and in
              the flow of the page rather than over it, so it can never sit on
              top of a control. Renders nothing for everybody else. */}
          <ChooseUsername />

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
