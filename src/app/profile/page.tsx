import { RoutePlaceholder } from "@/components/route-placeholder";

export const metadata = {
  title: "Profile",
};

export default function ProfilePage() {
  return (
    <RoutePlaceholder
      eyebrow="Milestone 13 target"
      title="Profile and Progress"
      description="Saved accomplishments, selected pollinator, badges, and progress summaries will appear here."
      tasks={[
        "Show signed-in identity",
        "Summarize saved progress",
        "Display earned badges",
      ]}
    />
  );
}
