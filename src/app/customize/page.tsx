import type { Metadata } from "next";

import { redirectIfSuspended } from "@/features/auth/components/sign-in-required";
import { Customize } from "@/features/game/components/customize";

export const metadata: Metadata = {
  title: "Customize · Scout",
  description: "Name and dress your pollinator before you fly.",
};

export default async function CustomizePage() {
  await redirectIfSuspended();

  return (
    <main className="page-container">
      <p className="eyebrow">Your pollinator</p>
      <h1>Make it yours</h1>
      <p className="lead">
        A name, a colour, and something silly on its head. It has a long way to
        fly.
      </p>
      <Customize />
    </main>
  );
}
