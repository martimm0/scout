import type { Metadata } from "next";

import { OfflineRun } from "@/features/game/components/offline-run";

export const metadata: Metadata = {
  title: "Offline run · Scout",
  description:
    "Ten minutes as a pollinator in Frick Park. No account, nothing saved.",
};

export default function OfflinePage() {
  return <OfflineRun />;
}
