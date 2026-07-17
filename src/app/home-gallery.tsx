"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import styles from "./home-gallery.module.css";

/**
 * Real frames from the game, captured across parks, weather and time of day,
 * because those three are the whole pitch and a static banner sells none of
 * them. The order tells a small story: the same creek at midday and at dusk
 * (the park is on Pittsburgh's clock), then rain (it is on Pittsburgh's
 * weather), then the other two parks.
 *
 * It advances itself every few seconds, unless the reader has asked for reduced
 * motion, in which case it holds still and the dots do the driving.
 */
const SLIDES = [
  {
    src: "/images/gallery/frick-midday.png",
    alt: "A bee over the creek at the bottom of Frick Park at midday",
    caption: "Frick Park. A wood with a creek at the bottom of it.",
  },
  {
    src: "/images/gallery/frick-dusk.png",
    alt: "The same creek at dusk, the meadow warm with low light",
    caption: "The same creek at dusk. The park keeps Pittsburgh time.",
  },
  {
    src: "/images/gallery/frick-rain.png",
    alt: "Rain falling over Frick Park",
    caption: "Real weather. If it is raining in Squirrel Hill, it is raining here.",
  },
  {
    src: "/images/gallery/schenley-hollow.png",
    alt: "The bee above Panther Hollow in Schenley Park",
    caption: "Panther Hollow, Schenley. A hundred feet deep.",
  },
  {
    src: "/images/gallery/highland-reservoir.png",
    alt: "Highland Park, with a reservoir wall in the distance",
    caption: "Highland Park. A lake on top of a hill.",
  },
];

const INTERVAL = 4500;

export function HomeGallery() {
  const [current, setCurrent] = useState(0);
  const [motion, setMotion] = useState(true);
  const paused = useRef(false);

  // Respect a reduced-motion preference: no auto-advance, and the reader steps
  // through with the dots instead.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!motion) return;
    const id = window.setInterval(() => {
      if (!paused.current) setCurrent((i) => (i + 1) % SLIDES.length);
    }, INTERVAL);
    return () => window.clearInterval(id);
  }, [motion]);

  return (
    <div
      className={styles.gallery}
      onBlur={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div className={styles.frame}>
        {SLIDES.map((slide, i) => (
          <Image
            alt={slide.alt}
            aria-hidden={i !== current}
            className={styles.slide}
            data-active={i === current}
            fill
            key={slide.src}
            priority={i === 0}
            sizes="(max-width: 720px) 100vw, 560px"
            src={slide.src}
          />
        ))}
        <p aria-live="polite" className={styles.caption}>
          {SLIDES[current].caption}
        </p>
      </div>

      <div className={styles.dots} role="tablist">
        {SLIDES.map((slide, i) => (
          <button
            aria-current={i === current}
            aria-label={slide.caption}
            className={styles.dot}
            data-active={i === current}
            key={slide.src}
            onClick={() => setCurrent(i)}
            type="button"
          />
        ))}
      </div>
    </div>
  );
}
