import { RoutePlaceholder } from "@/components/route-placeholder";
import { IMAGE_ASSETS } from "@/lib/assets";

export const metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 13 target"
      title="Profile and Progress"
      description="Saved accomplishments, selected pollinator, badges, and progress summaries will appear here."
      imageAlt="Scout badge placeholder"
      imageSrc={IMAGE_ASSETS.badge}
      tasks={[
        "Show signed-in identity",
        "Summarize saved progress",
        "Display earned badges",
      ]}
    />
  );
}
