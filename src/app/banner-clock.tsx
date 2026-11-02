"use client";

import { useEffect, useState } from "react";

import { bannerLineAt } from "./banner-line";

/**
 * The banner's clock, kept on the visitor's side. The home page is rendered
 * ahead of time and reused for minutes at a stretch (longer, after a quiet
 * night), so a clock printed on the server is the time somebody else loaded
 * it. The server's line stands until hydration, then this one takes over and
 * keeps ticking.
 */
export function BannerClock({ initial }: { initial: string }) {
  const [line, setLine] = useState(initial);

  useEffect(() => {
    const tick = () => setLine(bannerLineAt(new Date()));

    tick();
    const timer = window.setInterval(tick, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return <>{line}</>;
}
