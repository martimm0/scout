import { RoutePlaceholder } from "@/components/route-placeholder";
import { IMAGE_ASSETS } from "@/lib/assets";

export const metadata = {
  title: "Offline Run",
};

export default function OfflinePage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 15 target"
      title="Offline 10-Minute Run"
      description="Offline mode will offer a complete timed run with temporary progress and no account requirement."
      imageAlt="Scout offline run placeholder"
      imageSrc={IMAGE_ASSETS.character}
      tasks={[
        "Choose a temporary pollinator",
        "Start a 10-minute timer",
        "Show end-run stats",
      ]}
    />
  );
}
