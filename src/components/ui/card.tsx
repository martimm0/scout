import type { HTMLAttributes, ReactNode } from "react";
import styles from "./card.module.css";

/**
 * A card, with a heading.
 *
 * The heading used to be a `title` prop that nobody rendered: `Card` spread its
 * props onto the div, so `<Card title="Find sixteen native plants">` set the HTML
 * `title` ATTRIBUTE and the words only ever appeared as a tooltip, if you hovered,
 * for a second, if you knew to. Every card on the landing page was headless and
 * had been since the day it was written.
 */
export function Card({
  children,
  className,
  title,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
}) {
  return (
    <div
      className={[styles.card, className].filter(Boolean).join(" ")}
      {...props}
    >
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      {children}
    </div>
  );
}
