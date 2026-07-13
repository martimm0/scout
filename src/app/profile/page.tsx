import type { Metadata } from "next";

import { Profile } from "@/features/game/components/profile";
import { authConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Profile · Scout",
  description: "Your pollinator, your progress, and the badges you've earned.",
};

export default function ProfilePage() {
  return (
    <main className="page-container">
      <p className="eyebrow">Profile</p>
      <h1>Where you&apos;ve got to</h1>
      <Profile authConfigured={authConfigured} />
    </main>
  );
}
