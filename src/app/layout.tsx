import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
              </nav>
            </div>
          </header>
          <main className="main-content">{children}</main>
          <footer className="site-footer">
            <div className="site-footer__inner">
              Scout MVP foundation for the Frick Park pollinator RPG.
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
