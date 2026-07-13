import type { Metadata } from "next";

import { Journal } from "@/features/game/components/journal";

export const metadata: Metadata = {
  title: "Journal · Scout",
  description:
    "Your record of Frick Park: the plants you've found, the places you've been, and what you've learned.",
};

export default function JournalPage() {
  return (
    <main className="page-container">
      <p className="eyebrow">Journal</p>
      <h1>Your pollinator record</h1>
      <p className="lead">
        Everything you&apos;ve found, everywhere you&apos;ve been, and what the
        park has taught you so far.
      </p>
      <Journal />
    </main>
  );
}
